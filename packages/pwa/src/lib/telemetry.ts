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

type ScrubbedIdentity<Value> = Value extends readonly (infer Item)[]
  ? ScrubbedIdentity<Item>[]
  : Value extends object
    ? Partial<{ [Key in keyof Value]: ScrubbedIdentity<Value[Key]> }>
    : Value;

// Check again at delivery: SDK buffers can outlive an opt-out or profile switch.
function scrubIdentity<Value>(value: Value, id: string | undefined): ScrubbedIdentity<Value> {
  if (Array.isArray(value)) {
    // SAFETY: Mapping retains the array's order and recursively scrubs each source element.
    return value.map((item) => scrubIdentity(item, id)) as ScrubbedIdentity<Value>;
  }

  if (!value || typeof value !== "object") {
    // SAFETY: This branch returns primitives and functions unchanged.
    return value as ScrubbedIdentity<Value>;
  }

  const result: Partial<{ [Key in keyof Value]: ScrubbedIdentity<Value[Key]> }> = {};

  for (const [key, field] of Object.entries(value)) {
    if (key === "user" && field && typeof field === "object" && "id" in field) {
      if (id && field.id === id) Object.assign(result, { [key]: field });
    } else if (["telemetryId", "user.id", "sentry.user.id", "did"].includes(key)) {
      const identity = field && typeof field === "object" && "value" in field ? field.value : field;

      if (id && identity === id) Object.assign(result, { [key]: field });
    } else {
      Object.assign(result, { [key]: scrubIdentity(field, id) });
    }
  }

  // SAFETY: The result contains only source keys; recursion can remove identity fields.
  return result as ScrubbedIdentity<Value>;
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
