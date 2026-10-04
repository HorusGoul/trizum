import { Repo } from "@automerge/automerge-repo";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { isTelemetryId } from "@trizum/analytics";
import * as Sentry from "@sentry/react";
import { Capacitor } from "@capacitor/core";
import { ensureTelemetryId, setPartyListId, type PartyList } from "#src/models/partyList.ts";
import {
  bindAnalytics,
  initializeAnalytics,
  trackCloudSyncActivated,
  trackEvent,
  trackPage,
} from "./analytics.ts";
import { getTelemetryId, setTelemetryIdentity, sentryTelemetryIntegration } from "./telemetry.ts";

vi.mock("@sentry/react", () => ({ setUser: vi.fn<typeof Sentry.setUser>() }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn<typeof Capacitor.isNativePlatform>(() => false) },
}));

let repo: Repo;
let cleanups: (() => void)[];
let browser: EventTarget & { location: { hostname: string; origin: string } };
let preferences: { onLine: boolean; doNotTrack?: string; globalPrivacyControl?: boolean };
let fetch: ReturnType<typeof vi.fn<typeof globalThis.fetch>>;

beforeEach(() => {
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  repo = new Repo({ network: [] });
  cleanups = [];
  browser = Object.assign(new EventTarget(), {
    location: { hostname: "trizum.app", origin: "https://trizum.app" },
  });
  preferences = { onLine: true };
  vi.stubGlobal("window", browser);
  vi.stubGlobal("navigator", preferences);
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) =>
    init?.method === "POST"
      ? new Response(null, { status: 204 })
      : new Response(
          'globalThis["__insightflare_tracker_runtime_config__"] = {"siteId":"9cf3da44-3ae9-478d-95aa-7015e864557e","collectToken":"test.token.signature"};\n',
        ),
  );
  vi.stubGlobal("fetch", fetch);
  vi.stubEnv("VITE_APP_ENABLE_ANALYTICS", "true");
  initializeAnalytics(["/", "/settings", "/party/$partyId"]);
});

afterEach(async () => {
  for (const cleanup of cleanups.reverse()) cleanup();
  setTelemetryIdentity();
  await repo.shutdown();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function profile(enabled?: boolean) {
  const handle = repo.create<PartyList>({
    id: "" as PartyList["id"],
    type: "partyList",
    username: "Alice",
    phone: "private",
    parties: {},
    participantInParties: {},
    ...(enabled === undefined ? {} : { usageAnalyticsEnabled: enabled }),
  });
  handle.change((doc) => {
    doc.id = handle.documentId;
  });
  return handle;
}

function payloads() {
  return fetch.mock.calls
    .filter(([, init]) => init?.method === "POST")
    .map(([, init]) => JSON.parse(init?.body as string));
}

it.each([false, true])("uses the first-party proxy on native=%s", async (native) => {
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(native);
  browser.location.origin = native ? "capacitor://localhost" : "https://preview.trizum.app";
  initializeAnalytics(["/"]);
  cleanups.push(bindAnalytics(profile(), () => "/"));
  await vi.waitFor(() => expect(payloads()).toHaveLength(1));
  const origin = native ? "https://trizum.app" : browser.location.origin;
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    new URL(`${origin}/api/spycat/script.js?siteId=9cf3da44-3ae9-478d-95aa-7015e864557e`),
    new URL(`${origin}/api/spycat/collect`),
  ]);
});

it("creates a random synced ID once and shares it with analytics and Sentry", async () => {
  const handle = profile();
  trackPage(`/party/${handle.documentId}?name=Alice`);
  trackEvent("party_created");
  expect(fetch).not.toHaveBeenCalled();
  cleanups.push(bindAnalytics(handle, () => `/party/${handle.documentId}?name=Alice`));
  const id = handle.doc().telemetryId;
  expect(isTelemetryId(id)).toBe(true);
  expect(id).not.toBe(handle.documentId);
  expect(ensureTelemetryId(handle)).toBe(id);
  expect(getTelemetryId()).toBe(id);
  expect(Sentry.setUser).toHaveBeenLastCalledWith({ id });
  await vi.waitFor(() => expect(payloads()).toHaveLength(2));
  expect(payloads().every((payload) => payload.userId === id)).toBe(true);
  expect(JSON.stringify(payloads())).not.toMatch(/Alice|private/);
  expect(JSON.stringify(payloads())).not.toContain(handle.documentId);
  handle.change((doc) => {
    doc.username = "Bob";
  });
  expect(handle.doc().telemetryId).toBe(id);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(payloads()).toHaveLength(2);
});

it.each(["opt-out", "DNT", "GPC"])("does not generate or expose identity for %s", async (gate) => {
  const handle = profile(gate === "opt-out" ? false : true);
  if (gate === "DNT") preferences.doNotTrack = "1";
  if (gate === "GPC") preferences.globalPrivacyControl = true;
  trackPage("/");
  trackEvent("party_created");
  cleanups.push(bindAnalytics(handle, () => "/"));
  expect(handle.doc().telemetryId).toBeUndefined();
  expect(getTelemetryId()).toBeUndefined();
  expect(Sentry.setUser).toHaveBeenLastCalledWith(null);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(fetch).not.toHaveBeenCalled();
});

it("immediately clears identity and pending events when opt-out arrives through sync", async () => {
  const handle = profile();
  cleanups.push(bindAnalytics(handle, () => "/"));
  trackEvent("party_created");
  const id = handle.doc().telemetryId;
  handle.change((doc) => {
    doc.usageAnalyticsEnabled = false;
  });
  expect(getTelemetryId()).toBeUndefined();
  expect(Sentry.setUser).toHaveBeenLastCalledWith(null);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(fetch).not.toHaveBeenCalled();
  handle.change((doc) => {
    doc.usageAnalyticsEnabled = true;
  });
  expect(getTelemetryId()).toBe(id);
  await vi.waitFor(() => expect(payloads()).toHaveLength(1));
});

it("clears the old profile synchronously and counts activation against the destination once ready", async () => {
  const source = profile();
  const destination = profile();
  const unbind = bindAnalytics(source, () => "/settings");
  cleanups.push(unbind);
  trackEvent("party_created");
  setPartyListId(destination.documentId);
  expect(getTelemetryId()).toBeUndefined();
  expect(Sentry.setUser).toHaveBeenLastCalledWith(null);
  trackCloudSyncActivated(destination.documentId);
  trackEvent("settings_saved");
  unbind();
  cleanups.pop();
  cleanups.push(bindAnalytics(destination, () => "/settings"));
  await vi.waitFor(() => expect(payloads()).toHaveLength(2));
  expect(payloads().map((payload) => payload.eventName)).toEqual([
    undefined,
    "cloud_sync_activated",
  ]);
  expect(payloads().every((payload) => payload.userId === destination.doc().telemetryId)).toBe(
    true,
  );
  browser.dispatchEvent(new Event("focus"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(payloads()).toHaveLength(2);
});

it("keeps offline logs correlated but drops offline analytics and refreshes the visit on reconnect", async () => {
  const handle = profile();
  preferences.onLine = false;
  cleanups.push(bindAnalytics(handle, () => "/settings"));
  expect(getTelemetryId()).toBe(handle.doc().telemetryId);
  trackEvent("settings_saved");
  preferences.onLine = true;
  browser.dispatchEvent(new Event("online"));
  await vi.waitFor(() => expect(payloads()).toHaveLength(1));
  expect(payloads()[0].kind).toBe("pageview");
});

it("reuses the synced ID on another replica and converges concurrent lazy migrations", () => {
  const first = profile();
  const second = repo.clone(first);
  const firstId = ensureTelemetryId(first);
  const secondId = ensureTelemetryId(second);
  expect(firstId).not.toBe(secondId);
  first.merge(second);
  second.merge(first);
  expect(ensureTelemetryId(first)).toBe(ensureTelemetryId(second));
  const synced = repo.clone(first);
  expect(ensureTelemetryId(synced)).toBe(first.doc().telemetryId);
});

it("repairs malformed stored identities without transmitting them", async () => {
  const handle = profile();
  handle.change((doc) => {
    doc.telemetryId = handle.documentId;
  });
  cleanups.push(bindAnalytics(handle, () => "/"));
  expect(isTelemetryId(handle.doc().telemetryId)).toBe(true);
  await vi.waitFor(() => expect(payloads()).toHaveLength(1));
  expect(JSON.stringify(payloads())).not.toContain(handle.documentId);
});

it("strips buffered Sentry user, log and session identities after privacy signals or profile changes", () => {
  const firstId = crypto.randomUUID();
  setTelemetryIdentity(() => firstId);
  const on = vi.fn<(event: string, listener: (envelope: unknown) => void) => void>();
  sentryTelemetryIntegration.setup!({ on } as unknown as Parameters<
    NonNullable<typeof sentryTelemetryIntegration.setup>
  >[0]);
  const beforeEnvelope = on.mock.calls[0][1] as (envelope: unknown) => void;
  const envelope = () => [
    {},
    [
      [{ type: "event" }, { user: { id: firstId }, message: "failure" }],
      [
        { type: "log" },
        {
          items: [
            {
              attributes: {
                "user.id": { value: firstId, type: "string" },
                telemetryId: { value: firstId, type: "string" },
              },
            },
          ],
        },
      ],
      [{ type: "session" }, { did: firstId, sid: "session-id" }],
      [{ type: "sessions" }, { aggregates: [{ did: firstId }] }],
    ],
  ];
  const allowed = envelope();
  beforeEnvelope(allowed);
  expect(JSON.stringify(allowed)).toContain(firstId);
  preferences.globalPrivacyControl = true;
  expect(getTelemetryId()).toBeUndefined();
  const blocked = envelope();
  beforeEnvelope(blocked);
  expect(JSON.stringify(blocked)).not.toContain(firstId);
  expect(JSON.stringify(blocked)).toContain("session-id");
  preferences.globalPrivacyControl = false;
  setTelemetryIdentity(() => crypto.randomUUID());
  const switched = envelope();
  beforeEnvelope(switched);
  expect(JSON.stringify(switched)).not.toContain(firstId);
});

it("does not replay activation rejected by destination preferences after re-enabling", async () => {
  const source = profile();
  const destination = profile(false);
  const unbind = bindAnalytics(source, () => "/settings");
  setPartyListId(destination.documentId);
  trackCloudSyncActivated(destination.documentId);
  unbind();
  cleanups.push(bindAnalytics(destination, () => "/settings"));
  destination.change((doc) => {
    doc.usageAnalyticsEnabled = true;
  });
  await vi.waitFor(() => expect(payloads()).toHaveLength(1));
  expect(payloads()[0].kind).toBe("pageview");
});
