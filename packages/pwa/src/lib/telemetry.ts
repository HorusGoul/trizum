import { z } from "zod";
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

  if (!isTelemetryObject(value)) {
    // SAFETY: This branch returns primitives and functions unchanged.
    return value as ScrubbedIdentity<Value>;
  }

  const result: Partial<{ [Key in keyof Value]: ScrubbedIdentity<Value[Key]> }> = {};

  for (const [key, field] of Object.entries(value)) {
    if (key === "user" && isTelemetryObject(field) && "id" in field) {
      if (id && field.id === id) Object.assign(result, { [key]: field });
    } else if (["telemetryId", "user.id", "sentry.user.id", "did"].includes(key)) {
      const identity = isTelemetryObject(field) && "value" in field ? field.value : field;

      if (id && identity === id) Object.assign(result, { [key]: field });
    } else {
      Object.assign(result, { [key]: scrubIdentity(field, id) });
    }
  }

  // SAFETY: The result contains only source keys; recursion can remove identity fields.
  return result as ScrubbedIdentity<Value>;
}

type SentryClient = NonNullable<ReturnType<typeof Sentry.getClient>>;

type SentryTransport = NonNullable<ReturnType<SentryClient["getTransport"]>>;

export type TelemetryEnvelope = Parameters<SentryTransport["send"]>[0];

interface TelemetryEnvelopeClient {
  on(event: "beforeEnvelope", listener: (envelope: TelemetryEnvelope) => void): void;
}

export const sentryTelemetryIntegration = {
  name: "TrizumTelemetryIdentity",
  setup(client: TelemetryEnvelopeClient) {
    client.on("beforeEnvelope", (envelope) => {
      const id = getTelemetryId();

      for (const item of envelope[1]) {
        if (["event", "transaction", "log", "span", "session", "sessions"].includes(item[0].type)) {
          // SAFETY: The SDK owns the envelope item schema; scrubIdentity recursively preserves payload fields while replacing identity attributes.
          item[1] = scrubIdentity(item[1], id) as (typeof item)[1];
        }
      }
    });
  },
} satisfies Parameters<typeof Sentry.addIntegration>[0];

const telemetryCallableSchema = z.function();

const telemetryObjectSchema = z.custom<object>(
  (value) =>
    value !== null && Object(value) === value && !telemetryCallableSchema.safeParse(value).success,
);

function isTelemetryObject<Value>(value: Value): value is Value & object {
  return telemetryObjectSchema.safeParse(value).success;
}
