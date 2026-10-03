import { describe, expect, it, vi } from "vite-plus/test";
import { createAnalytics, hasPrivacySignal, type AnalyticsEvent } from "./index.js";
import { redactPathname } from "./privacy.js";
import { readCollectToken } from "./insightflare.js";

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

function harness() {
  const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) =>
    init?.method === "POST" ? new Response(null, { status: 204 }) : new Response(bootstrap()),
  );
  const canCollect = vi.fn<() => boolean>(() => true);
  const client = createAnalytics({
    siteId,
    endpoint: "https://analytics.example",
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
  it("makes no requests until preferences are loaded and explicitly applied", async () => {
    const { client, fetch } = harness();
    client.page("/settings");
    client.track("party_created");
    await client.flush();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends only safe page metadata and approved events with no extra properties", async () => {
    const { client, fetch, payloads } = harness();
    client.setEnabled(true);
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
    client.setEnabled(true);
    client.page("/party/first");
    client.page("/party/first");
    client.page("/party/second");
    await client.flush();
    expect(payloads()).toHaveLength(2);
    expect(payloads()[0].pathname).toBe(payloads()[1].pathname);
    expect(payloads()[0].visitId).not.toBe(payloads()[1].visitId);
  });

  it("rechecks privacy signals before bootstrap and collection", async () => {
    const { client, canCollect, fetch, payloads } = harness();
    client.setEnabled(true);
    canCollect.mockReturnValue(false);
    client.page("/");
    await client.flush();
    expect(fetch).not.toHaveBeenCalled();
    canCollect.mockReturnValue(true);
    fetch.mockImplementationOnce(async () => {
      canCollect.mockReturnValue(false);
      return new Response(bootstrap());
    });
    client.page("/settings");
    await client.flush();
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
    client.setEnabled(true);
    client.page("/");
    client.track("party_created");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    client.setEnabled(false);
    expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true);
    resolve(new Response(bootstrap()));
    await client.flush();
    expect(payloads()).toHaveLength(0);
    client.setEnabled(true);
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
    client.setEnabled(true);
    client.page("/");
    await expect(client.flush()).resolves.toBeUndefined();
    expect(payloads()).toHaveLength(0);
  });

  it("bounds queued events", async () => {
    const { client, payloads } = harness();
    client.setEnabled(true);
    client.page("/");
    for (let index = 0; index < 100; index++) client.track("expense_created");
    await client.flush();
    expect(payloads()).toHaveLength(20);
  });
});
