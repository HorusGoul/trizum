import { describe, expect, test } from "vite-plus/test";
import * as Sentry from "@sentry/react";
import { workerLogger } from "./log";
import app from "./sentryWorker";

describe("Worker observability probe", () => {
  test("is unavailable outside the preview environment", async () => {
    for (const environment of [undefined, "production"]) {
      const response = await app.request(
        "https://trizum.test/api/observability-check",
        { method: "POST" },
        { SENTRY_ENVIRONMENT: environment },
      );

      expect(response.status).toBe(404);
    }
  });

  test("exercises the unhandled error path in previews", async () => {
    const response = await app.request(
      "https://trizum.test/api/observability-check",
      { method: "POST" },
      { SENTRY_ENVIRONMENT: "preview" },
    );

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Internal Server Error");
  });
});

test("installs the Sentry sink after the initial console configuration", async () => {
  const envelopes: unknown[] = [];
  Sentry.init({
    dsn: "https://public@example.com/1",
    defaultIntegrations: false,
    enableLogs: true,
    sendClientReports: false,
    transport: () => ({
      send: async (envelope) => {
        envelopes.push(envelope);

        return { statusCode: 200 };
      },
      flush: async () => true,
    }),
  });

  try {
    workerLogger.warning("Worker warning sink regression");
    workerLogger.error("Worker error sink regression");
    expect(await Sentry.flush(2000)).toBe(true);
    const output = JSON.stringify(envelopes);
    expect(output).toContain('"type":"log"');
    expect(output).toContain("Worker warning sink regression");
    expect(output).toContain('"type":"event"');
    expect(output).toContain("Worker error sink regression");
  } finally {
    await Sentry.close();
  }
});
