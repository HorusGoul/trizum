import bs58check from "bs58check";
import type { LogRecord, Sink } from "@logtape/logtape";

const REDACTED_DOCUMENT_ID = "[REDACTED_DOCUMENT_ID]";
const DOCUMENT_ID_FIELD =
  /^(?:documentId|partyId|partyDocumentId|partyListDocumentId|automergeUrl)$/i;

function redactString(value: string): string {
  // Automerge document IDs are Base58Check-encoded 16-byte UUIDs. Checking the
  // checksum avoids masking unrelated identifiers and stack function names.
  return value.replace(/[1-9A-HJ-NP-Za-km-z]{20,}/g, (candidate) =>
    candidate.length <= 28 && bs58check.decodeUnsafe(candidate)?.length === 16
      ? REDACTED_DOCUMENT_ID
      : candidate,
  );
}

function redactValue(value: unknown, ancestors = new Set<object>()): unknown {
  if (typeof value === "string") return redactString(value);
  if (typeof value === "bigint" || typeof value === "symbol") return redactString(String(value));
  if (typeof value === "function") return "[Function]";
  if (value === null || typeof value !== "object") return value;
  if (ancestors.has(value)) return "[Circular]";
  if (ancestors.size >= 20) return "[Truncated]";

  ancestors.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => redactValue(item, ancestors));
    if (value instanceof Date) {
      return Number.isFinite(Date.prototype.getTime.call(value))
        ? Date.prototype.toISOString.call(value)
        : null;
    }
    if (value instanceof Map) return redactValue([...value.entries()], ancestors);
    if (value instanceof Set) return redactValue([...value], ancestors);

    // Keep Error instances useful to error-monitoring sinks, without retaining
    // custom prototypes or mutating the exception used by application code.
    const result: Record<string, unknown> | Error =
      value instanceof Error ? new Error(redactString(value.message)) : {};
    if (value instanceof Error && result instanceof Error) {
      result.name = redactString(value.name);
      result.stack = value.stack === undefined ? undefined : redactString(value.stack);
      if ("cause" in value) result.cause = redactValue(value.cause, ancestors);
      if (value instanceof AggregateError) {
        Object.defineProperty(result, "errors", {
          configurable: true,
          enumerable: true,
          value: redactValue(value.errors, ancestors),
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
