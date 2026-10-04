import { beforeEach, expect, it, vi } from "vite-plus/test";
import { Hono } from "hono";
import { createAnalytics } from "@trizum/analytics";
import type { ApiHonoEnv } from "../env";
import { createApiCorsMiddleware } from "../cors";
import { ANALYTICS_SITE_ID } from "../../src/lib/api/analyticsConfig";
import { spycatRoute } from "./spycat";

const service = { fetch: vi.fn<Fetcher["fetch"]>() };
const app = new Hono<ApiHonoEnv>()
  .use("/api/*", createApiCorsMiddleware())
  .route("/api/spycat", spycatRoute);
const env = { SPYCAT: service };
const bootstrap = `globalThis["__insightflare_tracker_runtime_config__"] = ${JSON.stringify({ siteId: ANALYTICS_SITE_ID, collectToken: "test.token.signature" })};\nthrow new Error("Do not execute");`;
const base = "https://trizum.app/api/spycat";

beforeEach(() => {
  vi.resetAllMocks();
  service.fetch.mockImplementation(
    async (_url, init) =>
      new Response(init?.method === "POST" ? null : bootstrap, {
        status: init?.method === "POST" ? 204 : 200,
        headers: {
          "access-control-allow-origin": "null",
          "set-cookie": "tracking=private",
          "cache-control": "public, max-age=86400",
          "content-type": "application/javascript",
        },
      }),
  );
});

it("answers native preflight locally and returns readable native responses", async () => {
  const response = await app.request(
    `${base}/collect`,
    {
      method: "OPTIONS",
      headers: {
        Origin: "capacitor://localhost",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    },
    env,
  );
  expect(response.status).toBe(204);
  expect(response.headers.get("access-control-allow-origin")).toBe("capacitor://localhost");
  expect(response.headers.get("access-control-allow-headers")).toBe("content-type");
  expect(service.fetch).not.toHaveBeenCalled();

  const collected = await app.request(
    `${base}/collect`,
    {
      method: "POST",
      headers: { Origin: "capacitor://localhost" },
      body: JSON.stringify({ siteId: ANALYTICS_SITE_ID }),
    },
    env,
  );
  expect(collected.status).toBe(204);
  expect(collected.headers.get("access-control-allow-origin")).toBe("capacitor://localhost");
  expect(collected.headers.get("set-cookie")).toBeNull();
  expect(collected.headers.get("cache-control")).toBe("no-store");
});

it("forwards only fixed URLs, allowed headers and original Cloudflare metadata", async () => {
  const request = new Request(
    `${base}/script.js?siteId=${ANALYTICS_SITE_ID}&url=https://evil.test&name=Alice`,
    {
      headers: {
        Origin: "capacitor://localhost",
        Cookie: "session=secret",
        Authorization: "Bearer secret",
        Referer: "https://trizum.app/party/private",
        "CF-Connecting-IP": "192.0.2.1",
        "User-Agent": "test-agent",
        "X-Forwarded-For": "198.51.100.1",
        "X-Real-IP": "198.51.100.2",
        "X-Custom": "secret",
      },
    },
  );
  const cf = { country: "ES", city: "Madrid", continent: "EU" };
  Object.defineProperty(request, "cf", { value: cf });
  const response = await app.fetch(request, env);
  expect(response.status).toBe(200);
  expect(await response.text()).toBe(bootstrap);
  expect(service.fetch).toHaveBeenCalledOnce();
  const [url, init] = service.fetch.mock.calls[0];
  expect(url).toBe(`https://spycat.horus.dev/script.js?siteId=${ANALYTICS_SITE_ID}`);
  expect(Object.fromEntries(new Headers(init?.headers))).toEqual({
    origin: "https://trizum.app",
    "cf-connecting-ip": "192.0.2.1",
    "user-agent": "test-agent",
  });
  expect(init?.cf).toBe(cf);
  expect(init?.redirect).toBe("manual");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("set-cookie")).toBeNull();
});

it("carries the real analytics client through both proxy routes with one IP and sanitized payloads", async () => {
  const id = crypto.randomUUID();
  const fetch: typeof globalThis.fetch = async (url, init) => {
    const request = new Request(url, init);
    request.headers.set("Origin", "capacitor://localhost");
    request.headers.set("CF-Connecting-IP", "192.0.2.1");
    return app.fetch(request, env);
  };
  const client = createAnalytics({
    endpoint: base,
    siteId: ANALYTICS_SITE_ID,
    hostname: "trizum.app",
    routes: ["/party/$partyId"],
    canCollect: () => true,
    fetch,
  });
  client.setEnabled(true, id);
  client.page("/party/SHARING_SECRET?name=Alice#financial-data");
  client.track("expense_created");
  await client.flush();
  expect(service.fetch).toHaveBeenCalledTimes(3);
  for (const [, init] of service.fetch.mock.calls) {
    expect(new Headers(init?.headers).get("cf-connecting-ip")).toBe("192.0.2.1");
  }
  const posts = service.fetch.mock.calls.slice(1);
  expect(posts.map(([url]) => url)).toEqual([
    "https://spycat.horus.dev/collect",
    "https://spycat.horus.dev/collect",
  ]);
  expect(JSON.parse(posts[1][1]?.body as string)).toMatchObject({
    userId: id,
    eventName: "expense_created",
    eventData: {},
    pathname: "/party/:redacted",
    collectToken: "test.token.signature",
  });
  expect(JSON.stringify(posts)).not.toMatch(/SHARING_SECRET|Alice|financial-data/);
});

it.each<Record<string, string>>([{ DNT: "1" }, { DNT: "yes" }, { "Sec-GPC": "1" }])(
  "drops privacy-signalled requests %o",
  async (headers) => {
    const response = await app.request(
      `${base}/script.js?siteId=${ANALYTICS_SITE_ID}`,
      { headers },
      env,
    );
    expect(response.status).toBe(204);
    expect(service.fetch).not.toHaveBeenCalled();
  },
);

it("rejects untrusted origins, unsupported routes, malformed payloads and other sites", async () => {
  expect(
    (
      await app.request(
        `${base}/script.js?siteId=${ANALYTICS_SITE_ID}`,
        { headers: { Origin: "https://evil.test" } },
        env,
      )
    ).status,
  ).toBe(403);
  expect((await app.request(`${base}/script.js?siteId=other`, {}, env)).status).toBe(400);
  expect((await app.request(`${base}/admin`, {}, env)).status).toBe(404);
  for (const body of ["{", "null", "[]", JSON.stringify({ siteId: "other" })]) {
    expect((await app.request(`${base}/collect`, { method: "POST", body }, env)).status).toBe(400);
  }
  expect(service.fetch).not.toHaveBeenCalled();
});

it("bounds request bodies even without a Content-Length header", async () => {
  const response = await app.request(
    `${base}/collect`,
    {
      method: "POST",
      body: JSON.stringify({ siteId: ANALYTICS_SITE_ID, data: "x".repeat(17_000) }),
    },
    env,
  );
  expect(response.status).toBe(413);
  expect(service.fetch).not.toHaveBeenCalled();
});

it("fails closed on missing services, upstream failures and redirects", async () => {
  const url = `${base}/script.js?siteId=${ANALYTICS_SITE_ID}`;
  expect((await app.request(url, {}, {})).status).toBe(503);
  service.fetch.mockRejectedValueOnce(new Error("Service unavailable"));
  expect((await app.request(url, {}, env)).status).toBe(502);
  service.fetch.mockResolvedValueOnce(
    new Response(null, {
      status: 302,
      headers: { Location: "https://evil.test", "Set-Cookie": "secret" },
    }),
  );
  const response = await app.request(url, {}, env);
  expect(response.status).toBe(502);
  expect(response.headers.get("location")).toBeNull();
  service.fetch.mockResolvedValueOnce(new Response("upstream error", { status: 503 }));
  expect((await app.request(url, {}, env)).status).toBe(503);
});
