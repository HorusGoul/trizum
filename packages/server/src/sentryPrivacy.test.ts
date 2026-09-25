import * as Sentry from "@sentry/node";
import { sentryDocumentIdRedaction } from "@trizum/logging/sentry";
import { afterEach, expect, test } from "vite-plus/test";

type CapturedEnvelope = [header: unknown, items: [header: { type: string }, payload: unknown][]];

afterEach(async () => {
  await Sentry.close();
  Sentry.getCurrentScope().clear();
  Sentry.getIsolationScope().clear();
});

test("redacts direct server exceptions and causes before transport", async () => {
  const documentId = "p3u5PhN9wrNpsGCwfkeef2LzF9";
  const envelopes: CapturedEnvelope[] = [];
  Sentry.init({
    ...sentryDocumentIdRedaction,
    dsn: "https://public@example.com/1",
    defaultIntegrations: false,
    integrations: [Sentry.linkedErrorsIntegration()],
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

  const cause = new TypeError(`Document ${documentId} is unavailable`);
  cause.stack = `TypeError: ${cause.message}\n    at find (/app/repo.js:42:7)`;
  const error = new Error("Membership check failed", { cause });
  Sentry.captureException(error, {
    contexts: { request: { url: `https://trizum.app/party/${documentId}` } },
    extra: { documentId },
  });
  expect(await Sentry.flush(2000)).toBe(true);

  expect(envelopes).toHaveLength(1);
  expect(JSON.stringify(envelopes)).not.toContain(documentId);
  const event = envelopes[0]![1][0]![1];
  expect(event).toMatchObject({
    level: "error",
    exception: {
      values: expect.arrayContaining([
        expect.objectContaining({
          type: "TypeError",
          value: "Document [REDACTED_DOCUMENT_ID] is unavailable",
          stacktrace: {
            frames: [expect.objectContaining({ filename: "/app/repo.js", lineno: 42, colno: 7 })],
          },
        }),
        expect.objectContaining({ type: "Error", value: "Membership check failed" }),
      ]),
    },
  });
  expect(error.cause).toBe(cause);
  expect(cause.message).toContain(documentId);
});
