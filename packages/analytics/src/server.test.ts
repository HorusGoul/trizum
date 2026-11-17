import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { createAnonymousServerAnalytics } from "./server.js";

const fetch = vi.fn<typeof globalThis.fetch>();
const siteId = "test-site";
const script = `globalThis["__insightflare_tracker_runtime_config__"] = ${JSON.stringify({ siteId, collectToken: "test.token.signature" })};\nthrow new Error("Never execute the remote SDK");`;

beforeEach(() => {
  fetch.mockReset();
  fetch.mockImplementation(
    async (_url, init) =>
      new Response(init?.method === "POST" ? null : script, {
        status: init?.method === "POST" ? 204 : 200,
      }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

it("sends a synthetic visit followed by an anonymous event with no user identity or properties", async () => {
  const trackEvent = createAnonymousServerAnalytics({ siteId, fetch });
  await trackEvent("mcp_party_created");
  expect(fetch).toHaveBeenCalledTimes(3);
  const [, visitInit] = fetch.mock.calls[1];
  const [, eventInit] = fetch.mock.calls[2];
  const visit = await new Response(visitInit?.body).json();
  const event = await new Response(eventInit?.body).json();
  expect(visit).toMatchObject({
    kind: "pageview",
    pathname: "/api/mcp",
    visitorId: "trizum-mcp-server",
    query: "",
    hash: "",
    title: "",
    referrerUrl: "",
  });
  expect(event).toEqual({
    ...visit,
    timestamp: expect.any(Number),
    kind: "custom_event",
    eventId: expect.any(String),
    eventName: "mcp_party_created",
    eventData: {},
  });
  expect(event).not.toHaveProperty("userId");
  expect(Object.fromEntries(new Headers(eventInit?.headers))).toEqual({
    origin: "https://trizum.app",
    "user-agent": "trizum/0.1 (MCP; anonymous analytics)",
    "content-type": "application/json",
  });
  expect(eventInit?.redirect).toBe("manual");
});

it("reuses a service visit and token while sending only one request per subsequent event", async () => {
  const trackEvent = createAnonymousServerAnalytics({ siteId, fetch });
  await trackEvent("mcp_party_viewed");
  await trackEvent("mcp_expense_added");
  const first = await new Response(fetch.mock.calls[2][1]?.body).json();
  const second = await new Response(fetch.mock.calls[3][1]?.body).json();
  expect(fetch).toHaveBeenCalledTimes(4);
  expect(first.visitId).toBe(second.visitId);
  expect(first.eventId).not.toBe(second.eventId);
  expect(first.visitorId).toBe(second.visitorId);
  expect(second).not.toHaveProperty("userId");
});

it("shares in-flight bootstrap across concurrent actions and refreshes after five minutes", async () => {
  const now = vi.spyOn(Date, "now").mockReturnValue(1000);
  const trackEvent = createAnonymousServerAnalytics({ siteId, fetch });
  await Promise.all([trackEvent("mcp_party_created"), trackEvent("mcp_party_viewed")]);
  expect(fetch).toHaveBeenCalledTimes(4);
  const first = await new Response(fetch.mock.calls[2][1]?.body).json();
  now.mockReturnValue(1000 + 5 * 60_000);
  await trackEvent("mcp_expense_added");
  expect(fetch).toHaveBeenCalledTimes(7);
  const refreshed = await new Response(fetch.mock.calls[6][1]?.body).json();
  expect(first.visitId).not.toBe(refreshed.visitId);
});

it("drops collection on bootstrap format changes, redirects, errors, or failed visit creation", async () => {
  const trackEvent = createAnonymousServerAnalytics({ siteId, fetch });
  fetch.mockResolvedValueOnce(new Response("Unknown SDK"));
  await expect(trackEvent("mcp_party_created")).resolves.toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockReset();
  fetch.mockResolvedValueOnce(
    new Response(null, { status: 302, headers: { Location: "https://other.test" } }),
  );
  await trackEvent("mcp_party_created");
  expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockReset();
  fetch.mockRejectedValueOnce(new Error("Collector offline"));
  await expect(trackEvent("mcp_party_created")).resolves.toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockReset();
  fetch
    .mockResolvedValueOnce(new Response(script))
    .mockResolvedValueOnce(new Response(null, { status: 503 }));
  await trackEvent("mcp_party_created");
  expect(fetch).toHaveBeenCalledTimes(2);
});
