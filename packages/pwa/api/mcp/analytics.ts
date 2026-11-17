import {
  createAnonymousServerAnalytics,
  hasPrivacySignal,
  type McpAnalyticsEvent,
} from "@trizum/analytics";
import { ANALYTICS_SITE_ID } from "../../src/lib/api/analyticsConfig";
import type { ApiEnv } from "../env";

const clients = new WeakMap<
  NonNullable<ApiEnv["SPYCAT"]>,
  ReturnType<typeof createAnonymousServerAnalytics>
>();

export function createMcpAnalytics(
  env: Pick<ApiEnv, "SPYCAT" | "MCP_ANALYTICS_ENABLED">,
  request: Request,
  waitUntil: (task: Promise<void>) => void,
): (event: McpAnalyticsEvent) => void {
  const service = env.SPYCAT;

  const enabled =
    env.MCP_ANALYTICS_ENABLED === "true" ||
    (env.MCP_ANALYTICS_ENABLED !== "false" && new URL(request.url).hostname === "trizum.app");

  if (
    !service ||
    !enabled ||
    hasPrivacySignal({
      doNotTrack: request.headers.get("DNT"),
      globalPrivacyControl: request.headers.get("Sec-GPC") === "1",
    })
  )
    return () => {};

  const trackEvent =
    clients.get(service) ??
    createAnonymousServerAnalytics({
      siteId: ANALYTICS_SITE_ID,
      fetch: (input, init) =>
        service.fetch(input, {
          ...init,
          // Override inherited edge identity for both IP-bound token issuance and
          // collection. Never attach request.cf, cookies, or any client header.
          headers: {
            ...Object.fromEntries(new Headers(init?.headers)),
            "CF-Connecting-IP": "0.0.0.0",
          },
          cf: {},
        }),
    });

  clients.set(service, trackEvent);

  return (event) => {
    waitUntil(trackEvent(event));
  };
}
