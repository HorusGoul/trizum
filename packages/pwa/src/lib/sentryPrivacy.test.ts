import * as Sentry from "@sentry/react";
import { sentryDocumentIdRedaction } from "@trizum/logging/sentry";
import { afterEach, expect, test } from "vite-plus/test";

const documentId = "p3u5PhN9wrNpsGCwfkeef2LzF9";
const partyUrl = `https://trizum.app/party/${documentId}`;

type CapturedEnvelope = [header: unknown, items: [header: { type: string }, payload: unknown][]];

afterEach(async () => {
  await Sentry.close();
  Sentry.getCurrentScope().clear();
  Sentry.getIsolationScope().clear();
});

test("removes document IDs from outgoing Sentry errors, breadcrumbs, logs, and traces", async () => {
  const envelopes: CapturedEnvelope[] = [];
  Sentry.init({
    ...sentryDocumentIdRedaction,
    dsn: "https://public@example.com/1",
    defaultIntegrations: false,
    enableLogs: true,
    tracesSampleRate: 1,
    sendClientReports: false,
    transport: () => ({
      send: async (envelope) => {
        envelopes.push(envelope);
        return { statusCode: 200 };
      },
      flush: async () => true,
    }),
  });

  Sentry.addBreadcrumb({ category: "navigation", data: { to: partyUrl } });
  expect(JSON.stringify(Sentry.getCurrentScope().getScopeData().breadcrumbs)).not.toContain(
    documentId,
  );
  Sentry.getCurrentScope().addEventProcessor((event) => ({
    ...event,
    request: { url: partyUrl, headers: { Referer: partyUrl } },
  }));
  Sentry.setContext("party", { url: partyUrl, documentId });
  Sentry.setTag("partyDocumentId", documentId);
  const error = new TypeError(`Document ${documentId} is unavailable`);
  error.stack = `TypeError: ${error.message}\n    at loadParty (https://trizum.app/assets/app.js:42:7)`;
  Sentry.captureException(error, { extra: { nested: { url: partyUrl } } });
  Sentry.logger.warn(`Could not load ${documentId}`, { partyUrl, operation: "loadParty" });
  Sentry.startSpan({ name: partyUrl, op: "navigation", forceTransaction: true }, () => {
    Sentry.startSpan({ name: `Fetch ${partyUrl}`, op: "http.client" }, (span) => {
      span.setAttribute("http.url", partyUrl);
    });
  });
  expect(await Sentry.flush(2000)).toBe(true);

  const payloads = envelopes.flatMap(([, items]) =>
    items.map(([header, payload]) => ({ header, payload })),
  );
  expect(payloads.map(({ header }) => header.type)).toEqual(
    expect.arrayContaining(["event", "log", "transaction"]),
  );
  expect(JSON.stringify(envelopes)).not.toContain(documentId);
  const event = payloads.find(({ header }) => header.type === "event")!.payload;
  expect(event).toMatchObject({
    level: "error",
    contexts: {
      trace: {
        trace_id: expect.stringMatching(/^[a-f0-9]{32}$/),
        span_id: expect.stringMatching(/^[a-f0-9]{16}$/),
      },
    },
    request: { url: "https://trizum.app/party/[REDACTED_DOCUMENT_ID]" },
    exception: {
      values: [
        {
          type: "TypeError",
          value: "Document [REDACTED_DOCUMENT_ID] is unavailable",
          stacktrace: {
            frames: [
              expect.objectContaining({
                filename: "https://trizum.app/assets/app.js",
                lineno: 42,
                colno: 7,
              }),
            ],
          },
        },
      ],
    },
    breadcrumbs: [
      { category: "navigation", data: { to: "https://trizum.app/party/[REDACTED_DOCUMENT_ID]" } },
    ],
  });
  expect(payloads.find(({ header }) => header.type === "log")!.payload).toMatchObject({
    items: [{ level: "warn", body: "Could not load [REDACTED_DOCUMENT_ID]" }],
  });
  expect(payloads.find(({ header }) => header.type === "transaction")!.payload).toMatchObject({
    transaction: "https://trizum.app/party/[REDACTED_DOCUMENT_ID]",
    spans: [
      {
        description: "Fetch https://trizum.app/party/[REDACTED_DOCUMENT_ID]",
        data: { "http.url": "https://trizum.app/party/[REDACTED_DOCUMENT_ID]" },
      },
    ],
  });
  expect(error.message).toContain(documentId);
});
