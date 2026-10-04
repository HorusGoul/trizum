import { readCollectToken } from "./insightflare.js";
import { isTelemetryId, redactPathname } from "./privacy.js";
import { analyticsEvents, type AnalyticsEvent } from "./events.js";

export { hasPrivacySignal, isTelemetryId } from "./privacy.js";

export type { AnalyticsEvent } from "./events.js";

export interface AnalyticsOptions {
  endpoint: string;
  siteId: string;
  hostname: string;
  routes: readonly string[];
  /** Native custom-scheme origins may need a simple POST with an opaque response. */
  collectionMode?: "cors" | "no-cors";
  /** Rechecked at collection time, including after asynchronous bootstrap. */
  canCollect: () => boolean;
  fetch?: typeof globalThis.fetch;
}

interface Visit {
  pathname: string;
  visitId: string;
  startedAt: number;
}

export function createAnalytics(options: AnalyticsOptions) {
  const endpoint = new URL(options.endpoint);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) {
    throw new Error("Analytics requires an HTTPS endpoint without credentials");
  }
  const scriptUrl = new URL("/script.js", endpoint.origin);
  scriptUrl.searchParams.set("siteId", options.siteId);
  const collectUrl = new URL("/collect", endpoint.origin);
  const fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  let state: "pending" | "enabled" | "disabled" = "pending";
  let telemetryId: string | undefined;
  let startup: Record<string, unknown>[] = [];
  const startupDeadline = Date.now() + 10_000;
  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  let controller = new AbortController();
  let visit: Visit | undefined;
  let lastPathname: string | undefined;
  let token: { value: string; expiresAt: number } | undefined;
  let queue = { pending: 0, tail: Promise.resolve() };

  function allowed() {
    return state === "enabled" && options.canCollect();
  }

  function discardStartup() {
    startup = [];
    clearTimeout(startupTimer);
    startupTimer = undefined;
  }

  function disable() {
    state = "disabled";
    telemetryId = undefined;
    discardStartup();
    controller.abort();
    controller = new AbortController();
    queue = { pending: 0, tail: Promise.resolve() };
    token = undefined;
    visit = undefined;
    lastPathname = undefined;
  }

  function canRecord() {
    if (!options.canCollect()) {
      disable();
      return false;
    }
    return state === "enabled" || (state === "pending" && Date.now() < startupDeadline);
  }

  async function send(payload: Record<string, unknown>, signal: AbortSignal) {
    if (signal.aborted || !allowed()) return;
    const request = new AbortController();
    const abortRequest = () => request.abort();
    signal.addEventListener("abort", abortRequest, { once: true });
    // Compose cancellation without AbortSignal.any/timeout (older iOS WebViews).
    const timeout = setTimeout(abortRequest, 5000);
    try {
      // Bound individual requests so an unavailable collector cannot hold the queue.
      const requestSignal = request.signal;
      if (!token || token.expiresAt <= Date.now()) {
        const response = await fetch(scriptUrl, {
          credentials: "omit",
          referrerPolicy: "no-referrer",
          cache: "no-store",
          signal: requestSignal,
        });
        if (!response.ok || signal.aborted || !allowed()) return;
        const value = readCollectToken(await response.text(), options.siteId);
        if (!value || signal.aborted || !allowed()) return;
        token = { value, expiresAt: Date.now() + 5 * 60_000 };
      }
      if (signal.aborted || !allowed()) return;
      const response = await fetch(collectUrl, {
        method: "POST",
        mode: options.collectionMode ?? "cors",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        headers: {
          "content-type": options.collectionMode === "no-cors" ? "text/plain" : "application/json",
        },
        signal: requestSignal,
        body: JSON.stringify({ ...payload, collectToken: token.value }),
      });
      // An opaque response exposes no status; it is not proof of ingestion.
      if (!response.ok && !(options.collectionMode === "no-cors" && response.type === "opaque")) {
        token = undefined;
      }
    } catch {
      // Offline, ad blockers and server errors must never affect app actions.
      token = undefined;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abortRequest);
    }
  }

  function enqueue(payload: Record<string, unknown>) {
    if (state === "pending") {
      if (startup.length >= 20) return;
      startup.push(payload);
      startupTimer ??= setTimeout(
        () => {
          discardStartup();
          visit = undefined;
          lastPathname = undefined;
        },
        Math.max(0, startupDeadline - Date.now()),
      );
      return;
    }
    if (!allowed() || queue.pending >= 20) return;
    const identified = { ...payload, userId: telemetryId };
    const signal = controller.signal;
    const currentQueue = queue;
    currentQueue.pending++;
    currentQueue.tail = currentQueue.tail
      .then(() => send(identified, signal))
      .finally(() => {
        currentQueue.pending--;
      });
  }

  function base(current: Visit) {
    return {
      siteId: options.siteId,
      hostname: options.hostname,
      ...current,
      timestamp: Date.now(),
      visitorId: "",
      query: "",
      hash: "",
      title: "",
      referrerUrl: "",
    };
  }

  function track(event: AnalyticsEvent) {
    if (
      !canRecord() ||
      !visit ||
      typeof event !== "string" ||
      !Object.hasOwn(analyticsEvents, event)
    )
      return;
    enqueue({
      ...base(visit),
      kind: "custom_event",
      eventId: crypto.randomUUID(),
      eventName: event,
      eventData: {},
    });
  }

  return {
    setEnabled(value: boolean, id?: string) {
      if (!value || !isTelemetryId(id) || !options.canCollect()) {
        disable();
        return;
      }
      if (state === "enabled" && telemetryId === id) return;
      if (state === "enabled") disable();
      const buffered = Date.now() < startupDeadline ? startup : [];
      if (state === "pending" && buffered.length === 0) {
        visit = undefined;
        lastPathname = undefined;
      }
      discardStartup();
      telemetryId = id;
      state = "enabled";
      for (const payload of buffered) enqueue(payload);
    },
    page(pathname: string) {
      if (!canRecord() || pathname === lastPathname) return;
      if (state === "pending" && startup.length >= 20) return;
      lastPathname = pathname;
      visit = {
        pathname: redactPathname(pathname, options.routes),
        visitId: crypto.randomUUID(),
        startedAt: Date.now(),
      };
      enqueue({ ...base(visit), kind: "pageview" });
    },
    track,
    /** Useful for deterministic checks; collection remains fire-and-forget in the UI. */
    flush: () => queue.tail,
  };
}

export type Analytics = ReturnType<typeof createAnalytics>;
