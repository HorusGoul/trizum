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

const expenseView = {
  partyId: "party",
  expenseId: "expense",
  version: "a".repeat(32),
  currency: "EUR",
  name: "Dinner",
  paidAt: "2026-11-06T20:00:00Z",
  amount: "10.00",
  isTransfer: false,
  paidBy: [{ participantId: "alice", amount: "10.00" }],
  shares: [{ participantId: "alice", type: "divide" as const, value: 1 }],
};

const options = {
  appOrigin: "https://trizum.app",
  widgetScript: "/* bundled widget */",
  widgetStyles: "/* bundled styles */",
  widgetSprite: '<svg style="display:none"></svg>',
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
    addParticipants: vi.fn<McpService["addParticipants"]>().mockResolvedValue(view),
    getExpense: vi.fn<McpService["getExpense"]>().mockResolvedValue(expenseView),
    updateParty: vi.fn<McpService["updateParty"]>().mockResolvedValue(view),
    updateParticipant: vi.fn<McpService["updateParticipant"]>().mockResolvedValue(view),
    updateExpense: vi.fn<McpService["updateExpense"]>().mockResolvedValue(view),
    deleteExpense: vi.fn<McpService["deleteExpense"]>().mockResolvedValue(view),
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
    "add_participants",
    "add_expense",
    "get_expense",
    "update_party",
    "update_participant",
    "update_expense",
    "delete_expense",
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

it.each([2, 3, 4, 5, 6])(
  "keeps published widget v%s readable for cached tool metadata",
  async (version) => {
    const { client } = await connect();
    const uri = `ui://trizum/party-v${version}.html`;
    const resource = await client.readResource({ uri });

    expect(resource.contents[0]).toMatchObject({
      uri,
      mimeType: "text/html;profile=mcp-app",
      text: expect.stringContaining(options.widgetScript),
    });
  },
);

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
  expect(service.addParticipants).not.toHaveBeenCalled();
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

it("validates participant additions and returns IDs for expense follow-ups", async () => {
  const { client, service } = await connect();
  service.addParticipants.mockResolvedValueOnce({
    ...view,
    participants: [
      ...view.participants,
      { id: "bob", name: "Bob", archived: false, balance: "0.00" },
    ],
  });
  expect(
    await client.callTool({ name: "prepare_write", arguments: { operation: "add_participants" } }),
  ).toMatchObject({ structuredContent: { requestId: "server-token" } });

  const added = await client.callTool({
    name: "add_participants",
    arguments: { requestId: "server-token", partyId: "party", participants: [" Bob "] },
  });

  expect(added.structuredContent).toMatchObject({
    participants: [view.participants[0], { id: "bob", name: "Bob" }],
  });
  expect(service.addParticipants).toHaveBeenCalledWith({
    requestId: "server-token",
    partyId: "party",
    participants: ["Bob"],
  });
  expect(
    await client.callTool({
      name: "add_participants",
      arguments: { requestId: "token", partyId: "party", participants: [" "] },
    }),
  ).toMatchObject({ isError: true });
  expect(
    await client.callTool({
      name: "add_participants",
      arguments: { requestId: "token", partyId: "party", participants: [] },
    }),
  ).toMatchObject({ isError: true });
  expect(service.addParticipants).toHaveBeenCalledTimes(1);
  expect(service.addExpense).not.toHaveBeenCalled();
});

it("reads full expense versions without rendering a party widget", async () => {
  const { client, service } = await connect();

  const result = await client.callTool({
    name: "get_expense",
    arguments: { partyId: "party", expenseId: "expense" },
  });

  expect(result.structuredContent).toEqual(expenseView);
  expect(service.getExpense).toHaveBeenCalledWith({ partyId: "party", expenseId: "expense" });
});

it("advertises destructive mutations and rejects empty updates or missing expense versions", async () => {
  const { client, service } = await connect();
  const { tools } = await client.listTools();

  for (const name of ["update_party", "update_participant", "update_expense", "delete_expense"]) {
    expect(tools.find((tool) => tool.name === name)).toMatchObject({
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    });
  }

  for (const [name, args] of [
    ["update_party", {}],
    ["update_participant", { participantId: "alice" }],
    ["update_expense", { expenseId: "expense", name: "Lunch" }],
    ["delete_expense", { expenseId: "expense" }],
  ] as const) {
    expect(
      await client.callTool({ name, arguments: { requestId: "token", partyId: "party", ...args } }),
    ).toMatchObject({ isError: true });
  }

  expect(service.updateParty).not.toHaveBeenCalled();
  expect(service.updateParticipant).not.toHaveBeenCalled();
  expect(service.updateExpense).not.toHaveBeenCalled();
  expect(service.deleteExpense).not.toHaveBeenCalled();
  expect(
    await client.callTool({
      name: "update_expense",
      arguments: {
        requestId: "token",
        partyId: "party",
        expenseId: "expense",
        version: expenseView.version,
        amount: "12.00",
      },
    }),
  ).toMatchObject({ structuredContent: view });
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
