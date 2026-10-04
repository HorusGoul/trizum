import { hasPrivacySignal, isTelemetryId } from "@trizum/analytics";
import * as Sentry from "@sentry/react";

let readIdentity: (() => string | undefined) | undefined;

/** Shared by analytics, Sentry and all PWA LogTape sinks. Never returns a document ID. */
export function getTelemetryId(): string | undefined {
  if (hasPrivacySignal(navigator)) return undefined;
  const id = readIdentity?.();
  return isTelemetryId(id) ? id : undefined;
}

export function setTelemetryIdentity(source?: () => string | undefined) {
  readIdentity = source;
  const id = getTelemetryId();
  Sentry.setUser(id ? { id } : null);
}

// Check again at delivery: SDK buffers can outlive an opt-out or profile switch.
function scrubIdentity(value: unknown, id: string | undefined): unknown {
  if (Array.isArray(value)) return value.map((item) => scrubIdentity(item, id));
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    if (key === "user" && field && typeof field === "object" && "id" in field) {
      if (id && field.id === id) result[key] = field;
    } else if (["telemetryId", "user.id", "sentry.user.id", "did"].includes(key)) {
      const identity = field && typeof field === "object" && "value" in field ? field.value : field;
      if (id && identity === id) result[key] = field;
    } else {
      result[key] = scrubIdentity(field, id);
    }
  }
  return result;
}

export const sentryTelemetryIntegration: Parameters<typeof Sentry.addIntegration>[0] = {
  name: "TrizumTelemetryIdentity",
  setup(client) {
    client.on("beforeEnvelope", (envelope) => {
      const id = getTelemetryId();
      for (const item of envelope[1]) {
        if (["event", "transaction", "log", "span", "session", "sessions"].includes(item[0].type)) {
          item[1] = scrubIdentity(item[1], id) as (typeof item)[1];
        }
      }
    });
  },
};
