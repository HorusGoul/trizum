import * as Sentry from "@sentry/node";
import { sentryDocumentIdRedaction } from "@trizum/logging/sentry";
import { resetSync } from "@logtape/logtape";
import { configureServerLogging, rootLogger } from "./log.ts";
import { afterEach, expect, test, vi } from "vite-plus/test";

type CapturedEnvelope = [header: unknown, items: [header: { type: string }, payload: unknown][]];

afterEach(async () => {
  resetSync();
  vi.unstubAllEnvs();
  await Sentry.close();
  Sentry.getCurrentScope().clear();
  Sentry.getIsolationScope().clear();
});

test("redacts server exceptions, causes, scope attributes, and formatted logs before transport", async () => {
  const documentId = "p3u5PhN9wrNpsGCwfkeef2LzF9";
  const envelopes: CapturedEnvelope[] = [];
  Sentry.init({
    ...sentryDocumentIdRedaction,
    dsn: "https://public@example.com/1",
    defaultIntegrations: false,
    integrations: [Sentry.linkedErrorsIntegration(), ...sentryDocumentIdRedaction.integrations],
    enableLogs: true,
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
  Sentry.setAttribute("partyDocumentId", documentId);
  Sentry.logger.warn(Sentry.logger.fmt`Document ${documentId} unavailable`, { documentId });
  expect(await Sentry.flush(2000)).toBe(true);

  expect(JSON.stringify(envelopes)).not.toContain(documentId);
  const items = envelopes.flatMap(([, envelopeItems]) => envelopeItems);
  const event = items.find(([header]) => header.type === "event")![1];
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
  expect(items.find(([header]) => header.type === "log")![1]).toMatchObject({
    items: [
      {
        body: "Document [REDACTED_DOCUMENT_ID] unavailable",
        attributes: {
          partyDocumentId: { value: "[REDACTED_DOCUMENT_ID]", type: "string" },
          documentId: { value: "[REDACTED_DOCUMENT_ID]", type: "string" },
          "sentry.message.template": { value: "Document %s unavailable", type: "string" },
          "sentry.message.parameter.0": { value: "[REDACTED_DOCUMENT_ID]", type: "string" },
        },
      },
    ],
  });
  expect(Sentry.getIsolationScope().getScopeData().attributes?.partyDocumentId).toBe(documentId);
  expect(error.cause).toBe(cause);
  expect(cause.message).toContain(documentId);
});

test("routes server warnings and higher to Sentry while keeping lower levels local", async () => {
  const envelopes: CapturedEnvelope[] = [];
  Sentry.init({
    ...sentryDocumentIdRedaction,
    dsn: "https://public@example.com/1",
    defaultIntegrations: false,
    enableLogs: true,
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
  resetSync();
  vi.stubEnv("NODE_ENV", "production");
  configureServerLogging();
  rootLogger.debug("Debug stays local");
  rootLogger.info("Info stays local");
  const documentId = "p3u5PhN9wrNpsGCwfkeef2LzF9";
  rootLogger.warning("Sync fallback {documentId}", { documentId });
  rootLogger.error("Sync failed");
  rootLogger.fatal("Storage unavailable");
  expect(await Sentry.flush(2000)).toBe(true);
  const items = envelopes.flatMap(([, envelopeItems]) => envelopeItems);
  expect(JSON.stringify(envelopes)).not.toContain(documentId);
  expect(JSON.stringify(envelopes)).not.toContain("stays local");
  expect(items.find(([header]) => header.type === "log")?.[1]).toMatchObject({
    items: [
      { level: "warn", body: expect.stringContaining("[REDACTED_DOCUMENT_ID]") },
      { level: "error", body: "Sync failed" },
      { level: "fatal", body: "Storage unavailable" },
    ],
  });
  expect(
    items.flatMap(([header, payload]) => (header.type === "event" ? [payload] : [])),
  ).toMatchObject([{ level: "error" }, { level: "fatal" }]);
});
