import bs58check from "bs58check";
import type { LogRecord, Sink } from "@logtape/logtape";

const REDACTED_DOCUMENT_ID = "[REDACTED_DOCUMENT_ID]";
const DOCUMENT_ID_FIELD =
  /^(?:documentId|partyId|partyDocumentId|partyListDocumentId|automergeUrl)$/i;
const nativeErrorStackDescriptor = getPropertyDescriptor(new Error(), "stack");

function getPropertyDescriptor(value: object, key: string): PropertyDescriptor | undefined {
  for (let current: object | null = value; current; current = Object.getPrototypeOf(current)) {
    const descriptor = Object.getOwnPropertyDescriptor(current, key);
    if (descriptor) return descriptor;
  }
}

function readErrorField(error: Error, key: string, descriptor: PropertyDescriptor): unknown {
  if ("value" in descriptor) return descriptor.value;
  // Native stack getters can live on the instance (V8) or prototype (Firefox).
  // They may format name and message, so neither field may execute user code.
  if (
    key === "stack" &&
    nativeErrorStackDescriptor?.get &&
    descriptor.get === nativeErrorStackDescriptor.get &&
    ["name", "message"].every((field) => {
      const property = getPropertyDescriptor(error, field);
      return property && "value" in property && typeof property.value === "string";
    })
  ) {
    try {
      return nativeErrorStackDescriptor.get.call(error);
    } catch {
      return "[Unavailable]";
    }
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

export function redactValue(value: unknown, ancestors = new Set<object>()): unknown {
  if (typeof value === "string") return redactString(value);
  if (typeof value === "bigint" || typeof value === "symbol") return redactString(String(value));
  if (typeof value === "function") return "[Function]";
  if (value === null || typeof value !== "object") return value;
  if (ancestors.has(value)) return "[Circular]";
  if (ancestors.size >= 20) return "[Truncated]";

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const result: unknown[] = [];
      for (let index = 0; index < value.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        result.push(
          descriptor && !("value" in descriptor)
            ? "[Accessor]"
            : redactValue(descriptor?.value, ancestors),
        );
      }
      return result;
    }
    if (value instanceof Date) {
      return Number.isFinite(Date.prototype.getTime.call(value))
        ? Date.prototype.toISOString.call(value)
        : null;
    }
    if (value instanceof Map) return redactValue([...value.entries()], ancestors);
    if (value instanceof Set) return redactValue([...value], ancestors);

    // Keep Error instances useful to error-monitoring sinks, without retaining
    // custom prototypes or mutating the exception used by application code.
    const result: Record<string, unknown> | Error = value instanceof Error ? new Error() : {};
    if (value instanceof Error && result instanceof Error) {
      delete result.stack;
      for (const key of ["name", "message", "stack", "cause", "errors"]) {
        const descriptor = getPropertyDescriptor(value, key);
        if (!descriptor) continue;
        Object.defineProperty(result, key, {
          configurable: true,
          enumerable: key === "errors",
          writable: true,
          value: redactValue(readErrorField(value, key, descriptor), ancestors),
        });
      }
    }

    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (!descriptor.enumerable) continue;
      const nextValue =
        "value" in descriptor
          ? DOCUMENT_ID_FIELD.test(key) && typeof descriptor.value === "string"
            ? REDACTED_DOCUMENT_ID
            : redactValue(descriptor.value, ancestors)
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
    ancestors.delete(value);
  }
}

function redactRecord(record: LogRecord): LogRecord {
  const rawMessage =
    typeof record.rawMessage === "string"
      ? redactString(record.rawMessage)
      : Object.assign(record.rawMessage.map(redactString), {
          raw: record.rawMessage.raw.map(redactString),
        });

  return {
    ...record,
    category: record.category.map(redactString),
    message: record.message.map((value) => redactValue(value)),
    rawMessage,
    properties: redactValue(record.properties) as Record<string, unknown>,
  };
}

export function withDocumentIdRedaction(sink: Sink): Sink {
  const redacted: Sink & Partial<Disposable & AsyncDisposable> = (record) => {
    sink(redactRecord(record));
  };
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
