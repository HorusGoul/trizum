import { expect, it, vi } from "vite-plus/test";
import { createMcpAnalytics } from "./analytics";
import { ANALYTICS_SITE_ID } from "../../src/lib/api/analyticsConfig";

function fixture() {
  const fetch = vi.fn<Fetcher["fetch"]>();
  fetch.mockImplementation(
    async (_url, init) =>
      new Response(
        init?.method === "POST"
          ? null
          : `globalThis["__insightflare_tracker_runtime_config__"] = ${JSON.stringify({ siteId: ANALYTICS_SITE_ID, collectToken: "test.token.signature" })};\n`,
        { status: init?.method === "POST" ? 204 : 200 },
      ),
  );
  const tasks: Promise<void>[] = [];

  const waitUntil = (task: Promise<void>) => {
    tasks.push(task);
  };

  return { env: { SPYCAT: { fetch } }, fetch, tasks, waitUntil };
}

it("schedules collection with a synthetic edge context and never forwards caller data", async () => {
  const { env, fetch, tasks, waitUntil } = fixture();

  const request = new Request("https://trizum.app/api/mcp?partyId=SECRET", {
    headers: {
      "CF-Connecting-IP": "192.0.2.123",
      "User-Agent": "Private client",
      Cookie: "private-cookie",
      Authorization: "Bearer private-token",
      Referer: "https://trizum.app/party/SECRET",
    },
  });

  Object.defineProperty(request, "cf", { value: { city: "Madrid", country: "ES" } });
  const trackEvent = createMcpAnalytics(env, request, waitUntil);
  trackEvent("mcp_party_created");
  expect(tasks).toHaveLength(1);
  await Promise.all(tasks);
  expect(fetch).toHaveBeenCalledTimes(3);

  for (const [, init] of fetch.mock.calls) {
    expect(init?.cf).toEqual({});
    expect(new Headers(init?.headers).get("CF-Connecting-IP")).toBe("0.0.0.0");
  }

  expect(JSON.stringify(fetch.mock.calls)).not.toMatch(
    /192\.0\.2\.123|Private client|private-cookie|private-token|Madrid|SECRET/,
  );
});

it.each<{ url: string; headers: Record<string, string>; enabled: string | undefined }>([
  { url: "https://preview.workers.dev/api/mcp", headers: {}, enabled: undefined },
  { url: "http://localhost:5173/api/mcp", headers: {}, enabled: undefined },
  { url: "https://trizum.app/api/mcp", headers: {}, enabled: "false" },
  { url: "https://trizum.app/api/mcp", headers: { DNT: "1" }, enabled: undefined },
  { url: "https://trizum.app/api/mcp", headers: { "Sec-GPC": "1" }, enabled: "true" },
])("does not collect when disabled or privacy-signalled: %o", async ({ url, headers, enabled }) => {
  const { env, fetch, tasks, waitUntil } = fixture();
  createMcpAnalytics(
    { ...env, MCP_ANALYTICS_ENABLED: enabled },
    new Request(url, { headers }),
    waitUntil,
  )("mcp_party_viewed");
  expect(tasks).toHaveLength(0);
  expect(fetch).not.toHaveBeenCalled();
});

it("supports explicit preview opt-in and drops events when no binding exists", async () => {
  const { env, fetch, tasks, waitUntil } = fixture();
  createMcpAnalytics(
    { ...env, MCP_ANALYTICS_ENABLED: "true" },
    new Request("https://preview.workers.dev/api/mcp"),
    waitUntil,
  )("mcp_party_viewed");
  await Promise.all(tasks);
  expect(fetch).toHaveBeenCalledTimes(3);
  createMcpAnalytics({}, new Request("https://trizum.app/api/mcp"), waitUntil)("mcp_party_viewed");
  expect(tasks).toHaveLength(1);
});

it("reuses the analytics client across requests while checking each request's privacy signal", async () => {
  const { env, fetch, tasks, waitUntil } = fixture();
  const request = new Request("https://trizum.app/api/mcp");
  createMcpAnalytics(env, request, waitUntil)("mcp_party_created");
  await Promise.all(tasks);
  expect(fetch).toHaveBeenCalledTimes(3);
  createMcpAnalytics(
    env,
    new Request(request, { headers: { DNT: "1" } }),
    waitUntil,
  )("mcp_party_viewed");
  expect(tasks).toHaveLength(1);
  createMcpAnalytics(env, request, waitUntil)("mcp_expense_added");
  await Promise.all(tasks);
  expect(fetch).toHaveBeenCalledTimes(4);
});
