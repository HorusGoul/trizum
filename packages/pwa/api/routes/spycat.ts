import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { ApiHonoEnv } from "../env";
import { isTrustedOrigin } from "../auth-origins";
import { ANALYTICS_SITE_ID } from "../../src/lib/api/analyticsConfig";
import { hasPrivacySignal } from "@trizum/analytics";

export const spycatRoute = new Hono<ApiHonoEnv>();

spycatRoute.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  const origin = c.req.header("Origin");
  if (origin && !isTrustedOrigin(origin, c.env)) return c.body(null, 403);
  if (
    hasPrivacySignal({
      doNotTrack: c.req.header("DNT"),
      globalPrivacyControl: c.req.header("Sec-GPC") === "1",
    })
  )
    return c.body(null, 204);
  await next();
});

spycatRoute.get("/script.js", async (c) => {
  if (c.req.query("siteId") !== ANALYTICS_SITE_ID) return c.body(null, 400);
  return forward(c.req.raw, c.env.SPYCAT, "script.js");
});

// This is an upstream protocol adapter; @trizum/analytics owns payload redaction.
spycatRoute.post("/collect", bodyLimit({ maxSize: 16_384 }), async (c) => {
  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    return c.body(null, 400);
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    !("siteId" in payload) ||
    payload.siteId !== ANALYTICS_SITE_ID
  ) {
    return c.body(null, 400);
  }
  return forward(c.req.raw, c.env.SPYCAT, "collect", JSON.stringify(payload));
});

async function forward(
  request: Request,
  service: Pick<Fetcher, "fetch"> | undefined,
  path: "script.js" | "collect",
  body?: string,
) {
  if (!service) return new Response(null, { status: 503 });
  const url = new URL(path, "https://spycat.horus.dev/");
  if (path === "script.js") url.searchParams.set("siteId", ANALYTICS_SITE_ID);
  const headers = new Headers({ Origin: "https://trizum.app" });
  // Preserve the edge-provided IP for both token issuance and verification.
  // A service binding avoids cross-zone public fetch rewriting it to a Worker IP.
  for (const name of ["CF-Connecting-IP", "User-Agent"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (body) headers.set("Content-Type", "application/json");
  try {
    const response = await service.fetch(url.toString(), {
      method: body ? "POST" : "GET",
      headers,
      body,
      cf: request.cf,
      redirect: "manual",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(4000)]),
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      return new Response(null, { status: 502 });
    }
    // Never pass through upstream cookies, cache policy, CORS headers or redirects.
    if (path === "collect") {
      await response.body?.cancel();
      return new Response(null, { status: response.status });
    }
    return new Response(response.body, {
      status: response.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
