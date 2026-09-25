import { inspect } from "node:util";
import bs58check from "bs58check";
import { getLogger, resetSync, type LogRecord } from "@logtape/logtape";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { configureTrizumLogging, getTrizumLogger } from "./index.js";

const documentId = bs58check.encode(new Uint8Array(16).fill(1));
const otherDocumentId = bs58check.encode(new Uint8Array(16));
const redactedId = "[REDACTED_DOCUMENT_ID]";

afterEach(() => {
  resetSync();
  vi.restoreAllMocks();
});

describe("document ID redaction at every sink", () => {
  test("sanitizes messages, templates, categories, properties, and nested errors", () => {
    const records: LogRecord[] = [];
    configureTrizumLogging({
      surface: "pwa",
      extraSinks: { recording: (record) => records.push(record) },
      surfaceSinks: ["recording"],
    });
    const cause = new TypeError(`Document ${otherDocumentId} is unavailable`);
    const error = new AggregateError([cause], `Document ${documentId} is unavailable`, {
      cause,
    });
    error.stack = `${error.name}: ${error.message}\n    at find (repo.js:12:3)`;
    const logger = getTrizumLogger("pwa", documentId).with({ requestId: "request-123" });

    logger.warning(`Could not load ${documentId}: {error}`, {
      error,
      nested: [{ [`automerge:${documentId}`]: `https://trizum.app/party/${documentId}` }],
      partyListDocumentId: otherDocumentId,
    });
    expect(logger.warning`Document ${documentId}: ${error}`).toBeUndefined();

    expect(records).toHaveLength(2);
    expect(inspect(records, { depth: null, showHidden: true })).not.toContain(documentId);
    expect(inspect(records, { depth: null, showHidden: true })).not.toContain(otherDocumentId);
    expect(records[0]).toMatchObject({
      category: ["trizum", "pwa", redactedId],
      level: "warning",
      rawMessage: `Could not load ${redactedId}: {error}`,
      properties: {
        requestId: "request-123",
        partyListDocumentId: redactedId,
        error: {
          name: "AggregateError",
          message: `Document ${redactedId} is unavailable`,
          stack: expect.stringContaining("at find (repo.js:12:3)"),
          cause: { name: "TypeError", message: `Document ${redactedId} is unavailable` },
          errors: [{ name: "TypeError", message: `Document ${redactedId} is unavailable` }],
        },
      },
    });
    expect(records[0]!.properties.error).toBeInstanceOf(Error);
    expect(error.message).toContain(documentId);
    expect(error.cause).toBe(cause);
  });

  test("covers console, extra root sinks, and LogTape meta diagnostics", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const records: LogRecord[] = [];
    const dispose = vi.fn<() => void>();
    const sink = Object.assign((record: LogRecord) => records.push(record), {
      [Symbol.dispose]: dispose,
    });
    configureTrizumLogging({
      surface: "server",
      consoleFormat: "json",
      extraSinks: { monitoring: sink },
      extraLoggers: [{ category: [], sinks: ["monitoring"], lowestLevel: "warning" }],
    });

    getTrizumLogger("server").warning(`Document ${documentId}`);
    getLogger(["logtape", "meta"]).warning(`Document ${documentId}`);

    expect(warn).toHaveBeenCalledTimes(2);
    expect(inspect(warn.mock.calls)).not.toContain(documentId);
    expect(records).toHaveLength(1);
    expect(records[0]!.message).toEqual([`Document ${redactedId}`]);
    resetSync();
    expect(dispose).toHaveBeenCalledOnce();
  });

  test("handles circular payloads and custom serializers without leaking or dropping logs", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    configureTrizumLogging({ surface: "pwa", consoleFormat: "json" });
    const date = new Date("2026-01-01T00:00:00Z");
    date.toJSON = () => documentId;
    const payload: Record<string, unknown> = {
      documentId,
      toJSON: () => ({ secret: documentId }),
      map: new Map([[documentId, new Set([otherDocumentId])]]),
      code: "DOCUMENT_UNAVAILABLE",
      count: 2,
      date,
    };
    payload.self = payload;
    Object.defineProperty(payload, "unsafe", {
      enumerable: true,
      get() {
        throw new Error(`Document ${documentId}`);
      },
    });

    getTrizumLogger("pwa").warning("Lookup failed", { payload });

    expect(warn).toHaveBeenCalledExactlyOnceWith(expect.any(String));
    const output = warn.mock.calls[0]![0] as string;
    expect(output).not.toContain(documentId);
    expect(output).not.toContain(otherDocumentId);
    expect(JSON.parse(output)).toMatchObject({
      properties: {
        payload: {
          code: "DOCUMENT_UNAVAILABLE",
          count: 2,
          date: "2026-01-01T00:00:00.000Z",
          self: "[Circular]",
        },
      },
    });
  });

  test("preserves ordinary IDs and stack locations that are not document IDs", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    configureTrizumLogging({ surface: "pwa", consoleFormat: "json" });
    const message = "PartyMembershipUnavailableError at worker.js:123:4";

    getTrizumLogger("pwa").warning(message, { requestId: "9c22b0d3a451-MAD" });

    expect(JSON.parse(warn.mock.calls[0]![0] as string)).toMatchObject({
      message,
      properties: { requestId: "9c22b0d3a451-MAD" },
    });
  });
});
