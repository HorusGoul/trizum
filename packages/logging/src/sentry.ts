import { redactValue } from "./redaction.js";

function redactSentryPayload<T extends object>(payload: T): T {
  // Sentry hooks receive serialized payloads. Keep their schema and correlation
  // fields while sanitizing every string, including URLs and stack frames.
  return redactValue(payload) as T;
}

/** Spread into Sentry.init() to cover telemetry that bypasses LogTape sinks. */
export const sentryDocumentIdRedaction = {
  beforeBreadcrumb: redactSentryPayload,
  beforeSend: redactSentryPayload,
  beforeSendLog: redactSentryPayload,
  beforeSendSpan: redactSentryPayload,
  beforeSendTransaction: redactSentryPayload,
};
