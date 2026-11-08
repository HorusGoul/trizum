import { z } from "zod";
import { Hono } from "hono";
import { expect, it } from "vite-plus/test";
import { mcpRoute } from "./mcp";
import { createApiI18nMiddleware } from "../i18n";
import type { ApiHonoEnv } from "../env";
import { vi } from "vite-plus/test";

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

it("advertises direct tools without a database, signing secret or preparation call", async () => {
  const response = await request(
    "POST",
    { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  );

  const result = z
    .object({
      result: z.object({
        tools: z.array(
          z.object({
            name: z.string(),
            inputSchema: z.object({ properties: z.record(z.string(), z.json()) }),
          }),
        ),
      }),
    })
    .parse(await response.json());

  expect(result.result.tools.map((tool) => tool.name)).toEqual([
    "create_party",
    "get_party",
    "add_participants",
    "add_expense",
    "get_expense",
    "update_party",
    "update_participant",
    "update_expense",
    "delete_expense",
  ]);

  for (const tool of result.result.tools)
    expect(tool.inputSchema.properties).not.toHaveProperty("requestId");
});

it("rate limits direct writes before opening sync without a database or signing secret", async () => {
  const limit = vi.fn<RateLimit["limit"]>().mockResolvedValue({ success: false });

  const response = await app.request(
    "https://trizum.app/api/mcp",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "create_party",
          arguments: { name: "Trip", currency: "EUR", participants: ["Alice"] },
        },
      }),
    },
    { MCP_WRITE_LIMITER: { limit } },
  );

  expect(await response.json()).toMatchObject({
    result: {
      isError: true,
      content: [{ text: expect.stringContaining("Too many write requests") }],
    },
  });
  expect(limit).toHaveBeenCalledOnce();
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
