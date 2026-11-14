import * as Sentry from "@sentry/node";

/** Observe the real SDK's capture path without sending test data over the network. */
export function captureTestMetrics(): Sentry.Metric[] {
  const captured: Sentry.Metric[] = [];

  const client = Sentry.init({
    dsn: "https://public@example.com/1",
    defaultIntegrations: false,
    enableMetrics: true,
    skipOpenTelemetrySetup: true,
    sendClientReports: false,
    transport: () => ({
      send: async () => ({ statusCode: 200 }),
      flush: async () => true,
    }),
  });

  client?.on("afterCaptureMetric", (metric) => captured.push(metric));

  return captured;
}
