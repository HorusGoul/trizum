/// <reference lib="esnext.disposable" />

import { z } from "zod";

import bs58check from "bs58check";
import type { LogRecord, Sink } from "@logtape/logtape";

const REDACTED_DOCUMENT_ID = "[REDACTED_DOCUMENT_ID]";

const DOCUMENT_ID_FIELD =
  /^(?:documentId|partyId|partyDocumentId|partyListDocumentId|automergeUrl)$/i;

type RedactedValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Error
  | RedactedValue[]
  | RedactedProperties;

interface RedactedProperties {
  [property: string]: RedactedValue;
}

const logStringSchema = z.string();
const logNumberSchema = z.union([z.number(), z.nan(), z.literal(Infinity), z.literal(-Infinity)]);

const redactedPrimitiveSchema = z.union([
  z.string().transform(redactString),
  z.bigint().transform((value) => redactString(String(value))),
  z.symbol().transform((value) => redactString(String(value))),
  logNumberSchema,
  z.boolean(),
  z.null(),
  z.undefined(),
]);

const logFunctionSchema = z.function();
const logObjectSchema = z.custom<object>((value) => value !== null && Object(value) === value);

const nativeErrorStackDescriptor = getPropertyDescriptor(new Error(), "stack");

function getPropertyDescriptor(value: Error, key: string): PropertyDescriptor | undefined {
  for (let current: object | null = value; current; current = Object.getPrototypeOf(current)) {
    const descriptor = Object.getOwnPropertyDescriptor(current, key);

    if (descriptor) return descriptor;
  }
}

function redactErrorField(
  error: Error,
  key: string,
  descriptor: PropertyDescriptor,
  redactor: z.ZodType<RedactedValue>,
): RedactedValue {
  if ("value" in descriptor) return redactor.parse(descriptor.value);

  // Native stack getters can live on the instance (V8) or prototype (Firefox).
  // They may format name and message, so neither field may execute user code.
  if (
    key === "stack" &&
    nativeErrorStackDescriptor?.get &&
    descriptor.get === nativeErrorStackDescriptor.get &&
    ["name", "message"].every((field) => {
      const property = getPropertyDescriptor(error, field);

      return property && "value" in property && logStringSchema.safeParse(property.value).success;
    })
  ) {
    let value: unknown;

    try {
      value = nativeErrorStackDescriptor.get.call(error);
    } catch {
      return "[Unavailable]";
    }

    return redactor.parse(value);
  }

  return "[Accessor]";
}

function redactString(value: string): string {
  // Automerge document IDs are Base58Check-encoded 16-byte UUIDs. Checking the
  // checksum avoids masking unrelated identifiers and stack function names.
  return value.replace(/[1-9A-HJ-NP-Za-km-z]{20,}/g, (candidate) =>
    candidate.length <= 28 && bs58check.decodeUnsafe(candidate)?.length === 16
      ? REDACTED_DOCUMENT_ID
      : candidate,
  );
}

const redactValueSchema = z.unknown().transform((input): RedactedValue => {
  const ancestors = new Set<object>();

  const redactor = z.unknown().transform((value): RedactedValue => {
    const primitive = redactedPrimitiveSchema.safeParse(value);

    if (primitive.success) return primitive.data;

    if (logFunctionSchema.safeParse(value).success) return "[Function]";
    const object = logObjectSchema.parse(value);

    if (ancestors.has(object)) return "[Circular]";

    if (ancestors.size >= 20) return "[Truncated]";

    ancestors.add(object);

    try {
      if (Array.isArray(object)) {
        const result: RedactedValue[] = [];

        for (let index = 0; index < object.length; index++) {
          const descriptor = Object.getOwnPropertyDescriptor(object, String(index));
          result.push(
            descriptor && !("value" in descriptor)
              ? "[Accessor]"
              : redactor.parse(descriptor?.value),
          );
        }

        return result;
      }

      if (object instanceof Date) {
        return Number.isFinite(Date.prototype.getTime.call(object))
          ? Date.prototype.toISOString.call(object)
          : null;
      }

      if (object instanceof Map) return redactor.parse([...object.entries()]);

      if (object instanceof Set) return redactor.parse([...object]);

      // Keep Error instances useful to error-monitoring sinks, without retaining
      // custom prototypes or mutating the exception used by application code.
      const result: RedactedProperties | Error = object instanceof Error ? new Error() : {};

      if (object instanceof Error && result instanceof Error) {
        delete result.stack;

        for (const key of ["name", "message", "stack", "cause", "errors"]) {
          const descriptor = getPropertyDescriptor(object, key);

          if (!descriptor) continue;
          Object.defineProperty(result, key, {
            configurable: true,
            enumerable: key === "errors",
            writable: true,
            value: redactErrorField(object, key, descriptor, redactor),
          });
        }
      }

      for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(object))) {
        if (!descriptor.enumerable) continue;

        const nextValue =
          "value" in descriptor
            ? DOCUMENT_ID_FIELD.test(key) && logStringSchema.safeParse(descriptor.value).success
              ? REDACTED_DOCUMENT_ID
              : redactor.parse(descriptor.value)
            : "[Accessor]";

        Object.defineProperty(result, redactString(key), {
          configurable: true,
          enumerable: true,
          writable: true,
          value: nextValue,
        });
      }

      return result;
    } finally {
      ancestors.delete(object);
    }
  });

  return redactor.parse(input);
});

export const redactValue = redactValueSchema.parse.bind(redactValueSchema);

function redactRecord(record: LogRecord): LogRecord {
  const rawMessage = isTemplateMessage(record.rawMessage)
    ? Object.assign(record.rawMessage.map(redactString), {
        raw: record.rawMessage.raw.map(redactString),
      })
    : redactString(record.rawMessage);

  // SAFETY: record.properties is a plain property map; redaction retains its string keys and replaces only values.
  return {
    ...record,
    category: record.category.map(redactString),
    message: record.message.map((value) => redactValue(value)),
    rawMessage,
    properties: redactValue(record.properties) as LogRecord["properties"],
  };
}

export function withDocumentIdRedaction(
  sink: Sink,
  getContext?: () => LogRecord["properties"],
): Sink {
  const redacted: Sink & Partial<Disposable & AsyncDisposable> = (record) => {
    const contextual = getContext
      ? { ...record, properties: { ...record.properties, ...getContext() } }
      : record;

    sink(redactRecord(contextual));
  };

  // SAFETY: Disposal is optional on a callable sink; both symbol properties are checked before forwarding them.
  const disposable = sink as Sink & Partial<Disposable & AsyncDisposable>;
  const dispose = disposable[Symbol.dispose];
  const asyncDispose = disposable[Symbol.asyncDispose];

  if (dispose) {
    redacted[Symbol.dispose] = dispose.bind(sink);
  }

  if (asyncDispose) {
    redacted[Symbol.asyncDispose] = asyncDispose.bind(sink);
  }

  return redacted;
}

function isTemplateMessage(message: LogRecord["rawMessage"]): message is TemplateStringsArray {
  return Array.isArray(message);
}
