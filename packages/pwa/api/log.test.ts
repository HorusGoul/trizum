import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { generateAutomergeUrl, parseAutomergeUrl } from "@automerge/automerge-repo/slim";
import { getLogger } from "../src/lib/log";
import { getRedactedPath, workerLogger } from "./log";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Worker console logging", () => {
  test("redacts document IDs everywhere in emitted errors", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { documentId } = parseAutomergeUrl(generateAutomergeUrl());
    const cause = new TypeError(`Document ${documentId} is unavailable`);
    const error = new Error(`Could not load automerge:${documentId}`, { cause });
    error.stack = `${error.name}: ${error.message}\n    at loadPreview (worker.js:42:7)`;

    getLogger("api", "partySharePreview").warning(
      "Could not load party share preview: {errorMessage}",
      {
        error,
        errorMessage: error.message,
        requestId: "test-request",
        nested: [{ url: `https://trizum.app/party/${documentId}/share` }],
      },
    );

    const output = warn.mock.calls[0]![0] as string;
    expect(output).not.toContain(documentId);
    expect(JSON.parse(output)).toMatchObject({
      level: "WARN",
      logger: "trizum.pwa.api.partySharePreview",
      properties: {
        requestId: "test-request",
        error: {
          name: "Error",
          message: "Could not load automerge:[REDACTED_DOCUMENT_ID]",
          stack: expect.stringContaining("at loadPreview (worker.js:42:7)"),
          cause: {
            name: "TypeError",
            message: "Document [REDACTED_DOCUMENT_ID] is unavailable",
          },
        },
      },
    });
    expect(error.message).toContain(documentId);
  });

  test("emits one readable JSON argument with structured error details", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cause = new TypeError("Connection closed");
    const error = new Error("Preview unavailable", { cause });

    getLogger("api", "partySharePreview").warning(
      "Could not load party share preview: {errorMessage}",
      { error, errorMessage: error.message, requestId: "test-request" },
    );

    expect(warn).toHaveBeenCalledExactlyOnceWith(expect.any(String));
    const output = warn.mock.calls[0]![0] as string;
    expect(output).not.toMatch(/%[co]|color:/);
    expect(output).not.toContain(String.fromCharCode(27));
    expect(JSON.parse(output)).toMatchObject({
      "@timestamp": expect.any(String),
      level: "WARN",
      logger: "trizum.pwa.api.partySharePreview",
      message: expect.stringContaining("Preview unavailable"),
      properties: {
        requestId: "test-request",
        error: {
          name: "Error",
          message: error.message,
          stack: error.stack,
          cause: { name: "TypeError", message: cause.message, stack: cause.stack },
        },
      },
    });
  });

  test.each(["info", "error"] as const)("preserves %s console severity", (level) => {
    const output = vi.spyOn(console, level).mockImplementation(() => {});

    workerLogger[level]("Worker request completed", { status: 200 });

    expect(output).toHaveBeenCalledExactlyOnceWith(expect.any(String));
    expect(JSON.parse(output.mock.calls[0]![0] as string)).toMatchObject({
      level: level.toUpperCase(),
      properties: { status: 200 },
    });
  });
});

describe("Worker path redaction", () => {
  test("redacts party document IDs from party page requests", () => {
    const path = getRedactedPath(new Request("https://trizum.app/party/abc123/share"));

    expect(path).toBe("/party/:partyId/share");
  });

  test("redacts party document IDs from generated image requests", () => {
    const path = getRedactedPath(new Request("https://trizum.app/api/og/party/abc123?v=1"));

    expect(path).toBe("/api/og/party/:partyId");
  });
});
