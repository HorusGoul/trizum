import * as Sentry from "@sentry/node";
import { afterEach, expect, test } from "vite-plus/test";
import { serverMetricsIntegration } from "./metrics.ts";

afterEach(async () => {
  await Sentry.close();
  Sentry.getCurrentScope().clear();
  Sentry.getIsolationScope().clear();
});

test("sends metrics with units and safe dimensions after stripping inherited request data", async () => {
  const envelopes: unknown[] = [];
  Sentry.init({
    dsn: "https://public@example.com/1",
    environment: "production",
    release: "test-release",
    defaultIntegrations: false,
    integrations: [serverMetricsIntegration],
    enableMetrics: true,
    skipOpenTelemetrySetup: true,
    sendClientReports: false,
    transport: () => ({
      send: async (envelope) => {
        envelopes.push(envelope);

        return { statusCode: 200 };
      },
      flush: async () => true,
    }),
  });
  Sentry.setUser({ id: "private-user", email: "private@example.com" });
  Sentry.setAttribute("documentId", "private-document");
  Sentry.setAttribute("url", "https://trizum.app/party/private-document");
  Sentry.metrics.count("server.storage.operations", 1, {
    attributes: { operation: "save", outcome: "success", chunkType: "snapshot" },
  });
  Sentry.metrics.distribution("server.storage.operation.duration", 12.5, { unit: "millisecond" });
  Sentry.setAttribute("operation", "private-scope-operation");
  Sentry.metrics.gauge("server.memory.rss", 4096, { unit: "byte" });
  expect(await Sentry.flush(2000)).toBe(true);
  const serialized = JSON.stringify(envelopes);
  expect(serialized).not.toContain("private");
  expect(serialized).not.toContain('"url"');
  expect(serialized).toContain('"operation":{"value":"save"');
  expect(serialized).toContain('"sentry.environment":{"value":"production"');
  expect(serialized).toContain('"sentry.release":{"value":"test-release"');
  expect(serialized).toContain('"unit":"millisecond"');
  expect(serialized).toContain('"unit":"byte"');
  expect(serialized).toContain('"value":12.5');
});
