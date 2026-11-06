import { expect, it } from "vite-plus/test";
import { WriteTokens, WRITE_WINDOW_MS } from "./writeTokens";

const secret = "mcp-unit-test-signing-secret-at-least-32-characters";

it("issues unique stateless write tokens with server-verified operation and deadlines", async () => {
  let now = Date.now();
  const tokens = new WriteTokens(secret, () => now);
  const first = await tokens.prepare("create_party");
  const second = await tokens.prepare("create_party");
  expect(first.requestId).not.toBe(second.requestId);
  expect(await tokens.verify(first.requestId, "create_party")).toMatch(/^[a-f0-9-]{36}$/);
  await expect(tokens.verify(first.requestId, "add_expense")).rejects.toThrow(
    "Invalid write request",
  );
  await expect(
    new WriteTokens(`${secret}-different`).verify(first.requestId, "create_party"),
  ).rejects.toThrow("Invalid write request");
  now += WRITE_WINDOW_MS;
  await expect(tokens.verify(first.requestId, "create_party")).rejects.toThrow("expired");
});

it("fails closed when no signing secret is configured", async () => {
  await expect(new WriteTokens(undefined).prepare("create_party")).rejects.toThrow(
    "not configured",
  );
});
