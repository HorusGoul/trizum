import { Hono } from "hono";
import { expect, it } from "vite-plus/test";
import { mcpRoute } from "./mcp";
import { createApiI18nMiddleware } from "../i18n";
import type { ApiEnv, ApiHonoEnv } from "../env";
import { vi } from "vite-plus/test";
import { WriteTokens, WRITE_WINDOW_MS } from "../mcp/writeTokens";

const app = new Hono<ApiHonoEnv>();

app.use("*", createApiI18nMiddleware());

app.route("/api/mcp", mcpRoute);

// The protocol-only requests in this file must never use bindings or connect to sync.
const env = {};

function request(method: string, headers: Record<string, string> = {}, body?: string) {
  return app.request("https://trizum.app/api/mcp", { method, headers, body }, env);
}

it("allows MCP preflights from ChatGPT and rejects untrusted browser origins", async () => {
  const response = await request("OPTIONS", { Origin: "https://chatgpt.com" });
  expect(response.status).toBe(204);
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://chatgpt.com");
  expect(response.headers.get("Access-Control-Allow-Headers")).toContain("MCP-Protocol-Version");
  expect((await request("OPTIONS", { Origin: "https://attacker.example" })).status).toBe(403);
  expect((await request("POST", { Origin: "null" })).status).toBe(403);
});

it("prepares stateless write tokens without database access and rejects expired writes", async () => {
  const secret = "route-test-mcp-secret-at-least-32-characters";
  const limit = vi.fn<RateLimit["limit"]>().mockResolvedValue({ success: true });
  const bindings = { BETTER_AUTH_SECRET: secret, MCP_WRITE_LIMITER: { limit } };

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  const prepare = await app.request(
    "https://trizum.app/api/mcp",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "prepare_write", arguments: { operation: "create_party" } },
      }),
    },
    bindings,
  );

  expect(await prepare.json()).toMatchObject({
    result: { structuredContent: { requestId: expect.any(String), expiresAt: expect.any(String) } },
  });

  const expired = await new WriteTokens(secret, () => Date.now() - WRITE_WINDOW_MS).prepare(
    "create_party",
  );

  const response = await app.request(
    "https://trizum.app/api/mcp",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "create_party",
          arguments: {
            requestId: expired.requestId,
            name: "Trip",
            currency: "EUR",
            participants: ["Alice"],
          },
        },
      }),
    },
    bindings,
  );

  expect(await response.json()).toMatchObject({
    result: { isError: true, content: [{ text: expect.stringContaining("expired") }] },
  });
  expect(limit).toHaveBeenCalledTimes(2);
});

it("initializes over JSON without touching storage and returns stateless method responses", async () => {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      clientInfo: { name: "test", version: "1" },
      capabilities: {},
    },
  });

  const response = await request(
    "POST",
    { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body,
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ result: { serverInfo: { name: "trizum" } } });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect((await request("GET")).status).toBe(405);
  expect((await request("DELETE")).status).toBe(405);
});

it("bounds the request body and rejects invalid JSON before opening sync", async () => {
  expect(
    (await request("POST", { "Content-Type": "application/json" }, "x".repeat(65537))).status,
  ).toBe(413);
  expect(
    (
      await request(
        "POST",
        { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
        "{",
      )
    ).status,
  ).toBe(400);
});
