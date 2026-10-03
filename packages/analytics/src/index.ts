import { readCollectToken } from "./insightflare.js";
import { redactPathname } from "./privacy.js";
import { analyticsEvents, type AnalyticsEvent } from "./events.js";

export { hasPrivacySignal } from "./privacy.js";

export type { AnalyticsEvent } from "./events.js";

export interface AnalyticsOptions {
  endpoint: string;
  siteId: string;
  hostname: string;
  routes: readonly string[];
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
  let enabled = false;
  let controller = new AbortController();
  let visit: Visit | undefined;
  let lastPathname: string | undefined;
  let token: { value: string; expiresAt: number } | undefined;
  let pending = 0;
  let tail = Promise.resolve();

  function allowed() {
    return enabled && options.canCollect();
  }

  async function send(payload: Record<string, unknown>, signal: AbortSignal) {
    try {
      if (signal.aborted || !allowed()) return;
      // Bound individual requests so an unavailable collector cannot hold the queue.
      const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(5000)]);
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
        credentials: "omit",
        referrerPolicy: "no-referrer",
        headers: { "content-type": "application/json" },
        signal: requestSignal,
        body: JSON.stringify({ ...payload, collectToken: token.value }),
      });
      if (!response.ok) token = undefined;
    } catch {
      // Offline, ad blockers and server errors must never affect app actions.
      token = undefined;
    }
  }

  function enqueue(payload: Record<string, unknown>) {
    if (!allowed() || pending >= 20) return;
    const signal = controller.signal;
    pending++;
    tail = tail
      .then(() => send(payload, signal))
      .finally(() => {
        pending--;
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

  return {
    setEnabled(value: boolean) {
      if (enabled === value) return;
      enabled = value;
      if (!value) {
        controller.abort();
        controller = new AbortController();
        token = undefined;
        visit = undefined;
        lastPathname = undefined;
      }
    },
    page(pathname: string) {
      if (!allowed() || pathname === lastPathname) return;
      lastPathname = pathname;
      visit = {
        pathname: redactPathname(pathname, options.routes),
        visitId: crypto.randomUUID(),
        startedAt: Date.now(),
      };
      enqueue({ ...base(visit), kind: "pageview" });
    },
    track(event: AnalyticsEvent) {
      if (
        !allowed() ||
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
    },
    /** Useful for deterministic checks; collection remains fire-and-forget in the UI. */
    flush: () => tail,
  };
}

export type Analytics = ReturnType<typeof createAnalytics>;
