import { analyticsEvents, type McpAnalyticsEvent } from "./events.js";
import { readCollectToken } from "./insightflare.js";

interface ServerAnalyticsOptions {
  siteId: string;
  /** A transport owned by the server; never forward incoming request headers or metadata. */
  fetch: typeof globalThis.fetch;
}

/** Aggregate MCP actions share a synthetic service visitor, never a human identity. */
export function createAnonymousServerAnalytics(options: ServerAnalyticsOptions) {
  const headers = {
    Origin: "https://trizum.app",
    "User-Agent": "trizum/0.1 (MCP; anonymous analytics)",
  };

  let context: { expiresAt: number; ready: ReturnType<typeof startVisit> } | undefined;

  async function startVisit(signal: AbortSignal) {
    const bootstrap = new URL("https://spycat.horus.dev/script.js");
    bootstrap.searchParams.set("siteId", options.siteId);
    const response = await options.fetch(bootstrap, { headers, signal, redirect: "manual" });

    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("Analytics bootstrap unavailable");
    }

    const collectToken = readCollectToken(await response.text(), options.siteId);

    if (!collectToken) throw new Error("Analytics bootstrap unsupported");
    const timestamp = Date.now();

    const base = {
      siteId: options.siteId,
      hostname: "trizum.app",
      pathname: "/api/mcp",
      visitId: crypto.randomUUID(),
      visitorId: "trizum-mcp-server",
      startedAt: timestamp,
      query: "",
      hash: "",
      title: "",
      referrerUrl: "",
      collectToken,
    };

    // A short-lived visit belongs to this service instance, never a person.
    const visit = await options.fetch("https://spycat.horus.dev/collect", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ...base, timestamp, kind: "pageview" }),
      signal,
      redirect: "manual",
    });

    await visit.body?.cancel();

    if (!visit.ok) throw new Error("Analytics visit unavailable");

    return base;
  }

  return async function trackEvent(event: McpAnalyticsEvent): Promise<void> {
    if (!Object.hasOwn(analyticsEvents, event) || !event.startsWith("mcp_")) return;
    const signal = AbortSignal.timeout(4000);

    if (context && context.expiresAt <= Date.now()) context = undefined;
    const current = (context ??= { expiresAt: Date.now() + 5 * 60_000, ready: startVisit(signal) });

    try {
      const base = await current.ready;
      signal.throwIfAborted();

      const collected = await options.fetch("https://spycat.horus.dev/collect", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...base,
          timestamp: Date.now(),
          kind: "custom_event",
          eventId: crypto.randomUUID(),
          eventName: event,
          eventData: {},
        }),
        signal,
        redirect: "manual",
      });

      await collected.body?.cancel();

      if (!collected.ok && context === current) context = undefined;
    } catch {
      // Collection is best-effort, bounded, and never retried or persisted.
      if (context === current) context = undefined;
    }
  };
}
