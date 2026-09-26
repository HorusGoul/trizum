import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { getLogger } from "../src/lib/log";
import { getRedactedPath, workerLogger } from "./log";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Worker console logging", () => {
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
