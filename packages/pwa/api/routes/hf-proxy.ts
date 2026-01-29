import { Hono } from "hono";

export const apiHfProxyRoute = new Hono();

/**
 * Proxy requests to HuggingFace CDN to avoid CORS issues.
 * Transformers.js fetches model files from cdn-lfs.hf.co and huggingface.co,
 * which don't set CORS headers for Web Worker requests.
 *
 * Routes:
 *   /api/hf/models/<org>/<model>/<path> → https://huggingface.co/<org>/<model>/resolve/main/<path>
 *   /api/hf/cdn/<path>                  → https://cdn-lfs.hf.co/<path>
 */

apiHfProxyRoute.get("/models/*", async (c) => {
  // Extract everything after /models/
  const path = c.req.path.replace(/^\/api\/hf\/models\//, "");

  if (!path) {
    return c.json({ error: "Missing model path" }, 400);
  }

  const url = `https://huggingface.co/${path}`;
  return proxyRequest(c, url);
});

apiHfProxyRoute.get("/cdn/*", async (c) => {
  // Extract everything after /cdn/
  const path = c.req.path.replace(/^\/api\/hf\/cdn\//, "");

  if (!path) {
    return c.json({ error: "Missing CDN path" }, 400);
  }

  const url = `https://cdn-lfs.hf.co/${path}`;
  return proxyRequest(c, url);
});

async function proxyRequest(
  c: { req: { raw: Request } },
  targetUrl: string,
): Promise<Response> {
  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "trizum-proxy",
      },
      redirect: "follow",
    });

    if (!response.ok && response.status !== 206) {
      return new Response(
        JSON.stringify({ error: `Upstream error: ${response.status}` }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Pass through all upstream headers and add CORS on top
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "*");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Proxy request failed",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
