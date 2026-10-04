import { describe, expect, it, vi } from "vite-plus/test";
import { createAnalytics, hasPrivacySignal, type AnalyticsEvent } from "./index.js";
import { redactPathname } from "./privacy.js";
import { readCollectToken } from "./insightflare.js";

const telemetryId = "d97261e3-d471-4960-86e6-e205d1d84c7a";
const siteId = "test-site";
const routes = [
  "/",
  "/settings",
  "/redeem",
  "/party/$partyId",
  "/party/$partyId/expense/$expenseId",
];
const documentId = "2f9VysjLKxYjBX7hQKQhEy1T2A5B";
const bootstrap = (site = siteId) =>
  '"use strict";globalThis["__insightflare_tracker_runtime_config__"] = ' +
  JSON.stringify({ siteId: site, collectToken: "test.token.signature", ignoreDoNotTrack: true }) +
  ';\nthrow new Error("This code must never execute");';

function harness(endpoint = "https://analytics.example") {
  const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) =>
    init?.method === "POST" ? new Response(null, { status: 204 }) : new Response(bootstrap()),
  );
  const canCollect = vi.fn<() => boolean>(() => true);
  const client = createAnalytics({
    siteId,
    endpoint,
    hostname: "trizum.app",
    routes,
    fetch,
    canCollect,
  });
  const payloads = () =>
    fetch.mock.calls
      .filter(([, init]) => init?.method === "POST")
      .map(
        ([, init]) =>
          JSON.parse(typeof init?.body === "string" ? init.body : "null") as Record<
            string,
            unknown
          >,
      );
  return { client, fetch, canCollect, payloads };
}

describe("privacy boundary", () => {
  it.each([
    [`/party/${documentId}`, "/party/:redacted"],
    [
      `/party/${documentId}/expense/${documentId}@secret?name=Alice#token`,
      "/party/:redacted/expense/:redacted",
    ],
    ["/party/%61%75%74%6F%6D%65%72%67%65%3Asecret", "/party/:redacted"],
    ["/redeem?code=PRIVATE#secret", "/redeem"],
    ["/settings/", "/settings"],
    ["/Alice/email@example.com", "/:unknown"],
    ["/", "/"],
  ])("redacts %s", (input, expected) => {
    expect(redactPathname(input, routes)).toBe(expected);
  });

  it.each([{ doNotTrack: "1" }, { doNotTrack: "yes" }, { globalPrivacyControl: true }])(
    "honors privacy signal %o",
    (signal) => expect(hasPrivacySignal(signal)).toBe(true),
  );

  it("does not treat DNT 0 as an opt-out", () => {
    expect(hasPrivacySignal({ doNotTrack: "0", globalPrivacyControl: false })).toBe(false);
  });

  it("parses only matching JSON configuration and never evaluates SDK code", () => {
    expect(readCollectToken(bootstrap(), siteId)).toBe("test.token.signature");
    expect(readCollectToken(bootstrap("other-site"), siteId)).toBeUndefined();
    expect(readCollectToken("alert('sdk changed')", siteId)).toBeUndefined();
    expect(
      readCollectToken(bootstrap().replace('"test.token.signature"', "evil()"), siteId),
    ).toBeUndefined();
  });
});

describe("analytics collection", () => {
  it.each(["https://trizum.app/api/spycat", "https://trizum.app/api/spycat/"])(
    "keeps proxy paths and uses readable CORS responses for %s",
    async (endpoint) => {
      const { client, fetch, payloads } = harness(endpoint);
      client.setEnabled(true, telemetryId);
      client.page(`/party/${documentId}`);
      client.track("party_created");
      await client.flush();
      expect(fetch.mock.calls[0][0]).toEqual(
        new URL("https://trizum.app/api/spycat/script.js?siteId=test-site"),
      );
      expect(payloads()).toHaveLength(2);
      for (const [url, init] of fetch.mock.calls.filter(([, init]) => init?.method === "POST")) {
        expect(url).toEqual(new URL("https://trizum.app/api/spycat/collect"));
        expect(init).toMatchObject({
          mode: "cors",
          credentials: "omit",
          referrerPolicy: "no-referrer",
          headers: { "content-type": "application/json" },
        });
      }
    },
  );

  it("collects on WebViews without AbortSignal static helpers", async () => {
    vi.stubGlobal("AbortSignal", {});
    try {
      const { client, payloads } = harness();
      client.setEnabled(true, telemetryId);
      client.page("/settings");
      client.track("settings_saved");
      await client.flush();
      expect(payloads().map((payload) => payload.kind)).toEqual(["pageview", "custom_event"]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("aborts stalled requests after five seconds without rejecting app actions", async () => {
    vi.useFakeTimers();
    try {
      const { client, fetch } = harness();
      fetch.mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new Error("Aborted")), {
              once: true,
            });
          }),
      );
      client.setEnabled(true, telemetryId);
      client.page("/settings");
      await vi.advanceTimersByTimeAsync(5000);
      await expect(client.flush()).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledOnce();
      expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("makes no requests until preferences are loaded and explicitly applied", async () => {
    const { client, fetch } = harness();
    client.page("/settings");
    client.track("party_created");
    await client.flush();
    expect(fetch).not.toHaveBeenCalled();
    client.setEnabled(false);
  });

  it("sends only safe page metadata and approved events with no extra properties", async () => {
    const { client, fetch, payloads } = harness();
    client.setEnabled(true, telemetryId);
    client.page(`/party/${documentId}?name=Alice#secret`);
    client.track("expense_created");
    client.track(documentId as AnalyticsEvent);
    for (const name of ["__proto__", "constructor", "toString", { name: "expense_created" }]) {
      client.track(name as AnalyticsEvent);
    }
    await client.flush();
    expect(fetch).toHaveBeenCalledTimes(3);
    const [page, event] = payloads();
    expect(page).toEqual({
      kind: "pageview",
      siteId,
      hostname: "trizum.app",
      pathname: "/party/:redacted",
      visitId: expect.any(String),
      startedAt: expect.any(Number),
      timestamp: expect.any(Number),
      visitorId: "",
      userId: telemetryId,
      query: "",
      hash: "",
      title: "",
      referrerUrl: "",
      collectToken: "test.token.signature",
    });
    expect(event).toMatchObject({
      kind: "custom_event",
      eventName: "expense_created",
      eventData: {},
      visitId: page.visitId,
    });
    expect(JSON.stringify(payloads())).not.toContain(documentId);
    expect(JSON.stringify(payloads())).not.toContain("Alice");
    for (const [, init] of fetch.mock.calls) {
      expect(init).toMatchObject({ credentials: "omit", referrerPolicy: "no-referrer" });
    }
  });

  it("deduplicates router notifications but counts different documents using the same template", async () => {
    const { client, payloads } = harness();
    client.setEnabled(true, telemetryId);
    client.page("/party/first");
    client.page("/party/first");
    client.page("/party/second");
    await client.flush();
    expect(payloads()).toHaveLength(2);
    expect(payloads()[0].pathname).toBe(payloads()[1].pathname);
    expect(payloads()[0].visitId).not.toBe(payloads()[1].visitId);
  });

  it("starts a fresh current-route visit on reconnect without replaying offline activity", async () => {
    const { client, canCollect, payloads } = harness();
    client.setEnabled(true, telemetryId);
    client.page("/settings");
    await client.flush();
    const previousVisit = payloads()[0].visitId;
    canCollect.mockReturnValue(false);
    client.setEnabled(false);
    client.page(`/party/${documentId}`);
    client.track("party_pinned");
    canCollect.mockReturnValue(true);
    client.setEnabled(true, telemetryId);
    client.page(`/party/${documentId}`);
    client.track("party_unpinned");
    await client.flush();
    expect(payloads()).toHaveLength(3);
    expect(payloads()[1]).toMatchObject({ kind: "pageview", pathname: "/party/:redacted" });
    expect(payloads()[1].visitId).not.toBe(previousVisit);
    expect(payloads()[2]).toMatchObject({
      eventName: "party_unpinned",
      pathname: "/party/:redacted",
      visitId: payloads()[1].visitId,
    });
  });

  it("establishes a visit after an offline cold launch", async () => {
    const { client, canCollect, payloads } = harness();
    canCollect.mockReturnValue(false);
    client.page("/settings");
    client.track("settings_saved");
    canCollect.mockReturnValue(true);
    client.setEnabled(true, telemetryId);
    client.page("/settings");
    client.track("settings_saved");
    await client.flush();
    expect(payloads().map((payload) => payload.kind)).toEqual(["pageview", "custom_event"]);
    expect(payloads()[1]).toMatchObject({ pathname: "/settings", eventName: "settings_saved" });
  });

  it("rechecks privacy signals before bootstrap and collection", async () => {
    const { client, canCollect, fetch, payloads } = harness();
    client.setEnabled(true, telemetryId);
    canCollect.mockReturnValue(false);
    client.page("/");
    await client.flush();
    expect(fetch).not.toHaveBeenCalled();
    canCollect.mockReturnValue(true);
    fetch.mockImplementationOnce(async () => {
      canCollect.mockReturnValue(false);
      return new Response(bootstrap());
    });
    client.setEnabled(true, telemetryId);
    client.page("/settings");
    await client.flush();
    expect(fetch).toHaveBeenCalledOnce();
    expect(payloads()).toHaveLength(0);
  });

  it("aborts pending bootstrap and discards queued events on opt-out", async () => {
    const { client, fetch, payloads } = harness();
    let resolve!: (response: Response) => void;
    fetch.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    client.setEnabled(true, telemetryId);
    client.page("/");
    client.track("party_created");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    client.setEnabled(false);
    expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true);
    resolve(new Response(bootstrap()));
    await client.flush();
    expect(payloads()).toHaveLength(0);
    client.setEnabled(true, telemetryId);
    client.page("/settings");
    await client.flush();
    expect(payloads()).toHaveLength(1);
  });

  it.each(["network", "http", "format"])("fails closed on %s failures", async (failure) => {
    const { client, fetch, payloads } = harness();
    fetch.mockImplementation(async () => {
      if (failure === "network") throw new Error("offline");
      return new Response("unexpected", { status: failure === "http" ? 503 : 200 });
    });
    client.setEnabled(true, telemetryId);
    client.page("/");
    await expect(client.flush()).resolves.toBeUndefined();
    expect(payloads()).toHaveLength(0);
  });

  it("bounds queued events", async () => {
    const { client, payloads } = harness();
    client.setEnabled(true, telemetryId);
    client.page("/");
    for (let index = 0; index < 100; index++) client.track("expense_created");
    await client.flush();
    expect(payloads()).toHaveLength(20);
  });
});

describe("startup buffering and telemetry identity", () => {
  it("flushes sanitized startup activity in order with its original timestamps", async () => {
    const { client, fetch, payloads } = harness();
    client.page(`/party/${documentId}?name=Alice#secret`);
    client.track("party_created");
    client.track("Alice" as AnalyticsEvent);
    const recordedBy = Date.now();
    await client.flush();
    expect(fetch).not.toHaveBeenCalled();
    client.setEnabled(true, telemetryId);
    client.page(`/party/${documentId}?name=Alice#secret`);
    await client.flush();
    expect(payloads().map(({ kind }) => kind)).toEqual(["pageview", "custom_event"]);
    for (const payload of payloads()) {
      expect(payload).toMatchObject({ userId: telemetryId, pathname: "/party/:redacted" });
      expect(payload.timestamp).toBeLessThanOrEqual(recordedBy);
    }
    expect(JSON.stringify(payloads())).not.toMatch(/Alice|secret|2f9Vysj/);
  });

  it("drops startup and explicitly disabled activity on opt-out", async () => {
    const { client, payloads } = harness();
    client.page("/");
    client.track("party_created");
    client.setEnabled(false);
    client.page("/settings");
    client.track("settings_saved");
    client.setEnabled(true, telemetryId);
    client.page("/settings");
    await client.flush();
    expect(payloads()).toHaveLength(1);
    expect(payloads()[0].kind).toBe("pageview");
  });

  it("expires the startup buffer after ten seconds and starts a fresh visit", async () => {
    vi.useFakeTimers();
    try {
      const { client, payloads } = harness();
      client.page("/settings");
      client.track("settings_saved");
      await vi.advanceTimersByTimeAsync(10_000);
      expect(vi.getTimerCount()).toBe(0);
      client.track("party_created");
      client.setEnabled(true, telemetryId);
      client.page("/settings");
      await client.flush();
      expect(payloads()).toHaveLength(1);
      expect(payloads()[0].kind).toBe("pageview");
    } finally {
      vi.useRealTimers();
    }
  });

  it("bounds the startup buffer to twenty events", async () => {
    const { client, payloads } = harness();
    client.page("/");
    for (let i = 0; i < 100; i++) client.track("party_created");
    client.setEnabled(true, telemetryId);
    await client.flush();
    expect(payloads()).toHaveLength(20);
  });

  it("discards buffered activity when a privacy signal blocks collection", async () => {
    const { client, canCollect, fetch, payloads } = harness();
    client.page("/");
    client.track("party_created");
    canCollect.mockReturnValue(false);
    client.setEnabled(true, telemetryId);
    await client.flush();
    expect(fetch).not.toHaveBeenCalled();
    canCollect.mockReturnValue(true);
    client.setEnabled(true, telemetryId);
    client.page("/settings");
    await client.flush();
    expect(payloads()).toHaveLength(1);
  });

  it.each([undefined, documentId, "Alice", "00000000-0000-0000-0000-000000000000"])(
    "rejects invalid telemetry identity %s",
    async (id) => {
      const { client, fetch } = harness();
      client.page("/");
      client.setEnabled(true, id);
      client.page("/settings");
      await client.flush();
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("cancels old-profile work without attaching a new ID to it or blocking the new queue", async () => {
    const { client, fetch, payloads } = harness();
    let resolve!: (response: Response) => void;
    fetch.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    client.setEnabled(true, telemetryId);
    client.page("/");
    for (let i = 0; i < 30; i++) client.track("party_created");
    const previousQueue = client.flush();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const nextId = crypto.randomUUID();
    client.setEnabled(true, nextId);
    expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true);
    client.page("/settings");
    client.track("settings_saved");
    await client.flush();
    resolve(new Response(bootstrap()));
    await previousQueue;
    expect(payloads().map(({ userId }) => userId)).toEqual([nextId, nextId]);
    expect(payloads()[1].eventName).toBe("settings_saved");
  });
});
