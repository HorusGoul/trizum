import { describe, expect, test } from "vite-plus/test";
import { getRedactedPath } from "./log";

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
