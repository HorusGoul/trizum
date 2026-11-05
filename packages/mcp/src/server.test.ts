import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { createMcpServer, handleMcpRequest } from "./server.js";
import { McpToolError, type McpService, type PartyView } from "./contracts.js";

const view: PartyView = {
  partyId: "party",
  url: "https://trizum.app/party/party",
  name: "Lisbon",
  symbol: "🏝️",
  description: "",
  currency: "EUR",
  participants: [{ id: "alice", name: "Alice", archived: false, balance: "0.00" }],
  expenses: [],
};

const options = {
  appOrigin: "https://trizum.app",
  widgetScript: "/* bundled widget */",
  locale: "en",
  openLabel: "Open",
  openErrorLabel: "Copy the link",
  expensesLabel: "Expenses",
  balancesLabel: "Balances",
  errorLabel: "Failed",
};

const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

async function connect() {
  const service = {
    prepareWrite: vi
      .fn<McpService["prepareWrite"]>()
      .mockResolvedValue({ requestId: "server-token", expiresAt: "2026-11-06T12:15:00Z" }),
    createParty: vi.fn<McpService["createParty"]>().mockResolvedValue(view),
    getParty: vi.fn<McpService["getParty"]>().mockResolvedValue(view),
    addExpense: vi.fn<McpService["addExpense"]>().mockResolvedValue(view),
  };

  const server = createMcpServer(service, options);
  const client = new Client({ name: "test-agent", version: "1" });
  clients.push(client);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { client, service };
}

it("advertises narrow tools with accurate hints and a sandboxed MCP Apps resource", async () => {
  const { client } = await connect();
  const { tools } = await client.listTools();
  expect(tools.map((tool) => tool.name)).toEqual([
    "prepare_write",
    "create_party",
    "get_party",
    "add_expense",
  ]);
  expect(tools[0]).toMatchObject({ annotations: { readOnlyHint: true, openWorldHint: false } });
  expect(tools[0]._meta).not.toHaveProperty("ui");
  expect(tools[1]).toMatchObject({
    annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: false },
    _meta: { securitySchemes: [{ type: "noauth" }] },
  });
  expect(tools[2]).toMatchObject({ annotations: { readOnlyHint: true } });
  const { resources } = await client.listResources();
  const resource = await client.readResource({ uri: resources[0].uri });
  expect(resource.contents[0]).toMatchObject({
    mimeType: "text/html;profile=mcp-app",
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } } },
  });
});

it("prepares a write without invoking party reads or mutations", async () => {
  const { client, service } = await connect();

  const result = await client.callTool({
    name: "prepare_write",
    arguments: { operation: "create_party" },
  });

  expect(result.structuredContent).toMatchObject({ requestId: "server-token" });
  expect(service.createParty).not.toHaveBeenCalled();
  expect(service.getParty).not.toHaveBeenCalled();
  expect(service.addExpense).not.toHaveBeenCalled();
});

it("validates write arguments before touching the service and returns structured party data", async () => {
  const { client, service } = await connect();
  const result = await client.callTool({ name: "get_party", arguments: { partyId: "party" } });
  expect(result.structuredContent).toEqual(view);
  expect(result._meta).toMatchObject({ locale: "en", openLabel: "Open" });
  expect(
    await client.callTool({
      name: "add_expense",
      arguments: { partyId: "party", amount: "1.234" },
    }),
  ).toMatchObject({ isError: true });
  expect(service.addExpense).not.toHaveBeenCalled();
});

it("returns public domain errors and hides unexpected exception details", async () => {
  const { client, service } = await connect();
  service.getParty.mockRejectedValueOnce(new McpToolError("Use a valid invite link."));
  expect(
    await client.callTool({ name: "get_party", arguments: { partyId: "party" } }),
  ).toMatchObject({ isError: true, content: [{ text: "Use a valid invite link." }] });
  service.getParty.mockRejectedValueOnce(new Error("secret-party-id database failure"));
  const result = await client.callTool({ name: "get_party", arguments: { partyId: "party" } });
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result)).not.toContain("secret-party-id");
});

it("handles fetch-native stateless HTTP initialization and rejects unsupported streaming", async () => {
  const { service } = await connect();

  const response = await handleMcpRequest(
    new Request("https://trizum.app/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test", version: "1" },
        },
      }),
    }),
    service,
    options,
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    id: 1,
    result: { serverInfo: { name: "trizum" } },
  });
  expect(response.headers.has("Mcp-Session-Id")).toBe(false);

  const streaming = await handleMcpRequest(
    new Request("https://trizum.app/api/mcp", { headers: { Accept: "text/event-stream" } }),
    service,
    options,
  );

  expect(streaming.status).toBe(405);
});
