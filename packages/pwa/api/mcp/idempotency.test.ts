import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import { afterAll, beforeAll, expect, it, vi } from "vite-plus/test";
import type { CreatePartyInput, PartyService, PartyView } from "@trizum/mcp/index";
import type { ApiEnv } from "../env";
import { IdempotentPartyService } from "./idempotency";
import type { McpAnalyticsEvent } from "@trizum/analytics";
import { WriteTokens, WRITE_WINDOW_MS } from "./writeTokens";
import { cleanupMcpOperations } from "./cleanup";

let directory: string;
let platform: Awaited<ReturnType<typeof getPlatformProxy<ApiEnv>>>;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "trizum-mcp-test-"));
  const configPath = join(directory, "wrangler.json");
  await writeFile(
    configPath,
    JSON.stringify({
      name: "mcp-test",
      compatibility_date: "2025-11-18",
      d1_databases: [{ binding: "DB", database_name: "test", database_id: "test" }],
    }),
  );
  platform = await getPlatformProxy<ApiEnv>({
    configPath,
    envFiles: [],
    persist: false,
    remoteBindings: false,
  });

  const migration = await readFile(
    fileURLToPath(new URL("../../migrations/0007_mcp_operations.sql", import.meta.url).href),
    "utf8",
  );

  for (const statement of migration
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)) {
    await platform.env.DB.prepare(statement).run();
  }
}, 30_000);

afterAll(async () => {
  await platform?.dispose();
  await rm(directory, { recursive: true, force: true });
});

const view: PartyView = {
  partyId: "party",
  url: "https://trizum.app/party/party",
  name: "Trip",
  currency: "EUR",
  symbol: "🏝️",
  description: "",
  participants: [],
  expenses: [],
};

async function fixture() {
  const createParty = vi.fn<PartyService["createParty"]>().mockResolvedValue(view);
  const addExpense = vi.fn<PartyService["addExpense"]>().mockResolvedValue(view);
  const addParticipants = vi.fn<PartyService["addParticipants"]>().mockResolvedValue(view);
  const getParty = vi.fn<PartyService["getParty"]>().mockResolvedValue(view);

  const getExpense = vi.fn<PartyService["getExpense"]>().mockResolvedValue({
    partyId: "party",
    expenseId: "expense",
    version: "a".repeat(32),
    currency: "EUR",
    name: "Dinner",
    amount: "10.00",
    paidAt: "2026-11-06T20:00:00Z",
    isTransfer: false,
    paidBy: [],
    shares: [],
  });

  const updateParty = vi.fn<PartyService["updateParty"]>().mockResolvedValue(view);
  const updateParticipant = vi.fn<PartyService["updateParticipant"]>().mockResolvedValue(view);
  const updateExpense = vi.fn<PartyService["updateExpense"]>().mockResolvedValue(view);
  const deleteExpense = vi.fn<PartyService["deleteExpense"]>().mockResolvedValue(view);
  const trackEvent = vi.fn<(event: McpAnalyticsEvent) => void>();
  const limitWrite = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  let now = Date.now();
  const tokens = new WriteTokens("test-mcp-signing-secret-at-least-32-characters", () => now);

  const service = new IdempotentPartyService(
    {
      createParty,
      addExpense,
      addParticipants,
      getParty,
      getExpense,
      updateParty,
      updateParticipant,
      updateExpense,
      deleteExpense,
    },
    platform.env.DB,
    { tokens, limitWrite, trackEvent },
  );

  const input: CreatePartyInput = {
    requestId: (await tokens.prepare("create_party")).requestId,
    name: "Trip",
    currency: "EUR",
    participants: ["Alice", "Bob"],
    description: "",
    symbol: "🏝️",
  };

  const requestKey = await tokens.verify(input.requestId, "create_party");

  return {
    service,
    createParty,
    addExpense,
    addParticipants,
    getParty,
    getExpense,
    updateParty,
    updateParticipant,
    updateExpense,
    deleteExpense,
    trackEvent,
    limitWrite,
    input,
    tokens,
    requestKey,
    advanceTime: (ms: number) => {
      now += ms;

      return now;
    },
  };
}

it("replays completed actions from D1 and rejects a requestId reused with other inputs", async () => {
  const { service, createParty, input, trackEvent, requestKey } = await fixture();
  expect(await service.createParty(input)).toEqual(view);
  expect(await service.createParty(input)).toEqual(view);
  expect(createParty).toHaveBeenCalledTimes(1);
  expect(trackEvent.mock.calls).toEqual([["mcp_party_created"]]);

  const stored = await platform.env.DB.prepare(
    "SELECT result FROM mcp_operations WHERE request_id = ?",
  )
    .bind(requestKey)
    .first<{ result: string }>();

  expect(JSON.parse(stored!.result)).toEqual({ partyId: view.partyId });
  await expect(service.createParty({ ...input, name: "Different trip" })).rejects.toThrow(
    "different action",
  );
  expect(createParty).toHaveBeenCalledTimes(1);
});

it("claims concurrent actions atomically before either can write to Automerge", async () => {
  const { service, createParty, input, trackEvent } = await fixture();

  const results = await Promise.allSettled([
    service.createParty(input),
    service.createParty(input),
  ]);

  expect(results.some((result) => result.status === "fulfilled")).toBe(true);
  expect(createParty).toHaveBeenCalledTimes(1);
  expect(await service.createParty(input)).toEqual(view);
  expect(trackEvent.mock.calls).toEqual([["mcp_party_created"]]);
});

it("preserves an ambiguous failure so a retry cannot create a duplicate", async () => {
  const { service, createParty, input, trackEvent } = await fixture();
  createParty.mockRejectedValueOnce(new Error("Sync acknowledgement lost"));
  await expect(service.createParty(input)).rejects.toThrow("acknowledgement lost");
  await expect(service.createParty(input)).rejects.toThrow("unconfirmed");
  expect(createParty).toHaveBeenCalledTimes(1);
  expect(trackEvent).not.toHaveBeenCalled();
});

it("deduplicates expense writes and keeps request IDs separate across tool names", async () => {
  const { service, addExpense, trackEvent, tokens } = await fixture();

  const expense = {
    requestId: (await tokens.prepare("add_expense")).requestId,
    partyId: "party",
    name: "Dinner",
    amount: "20.00",
    paidBy: "alice",
    splitBetween: ["alice", "bob"],
    paidAt: "2026-11-05T20:00:00Z",
  };

  await service.addExpense(expense);
  await service.addExpense(expense);
  expect(addExpense).toHaveBeenCalledTimes(1);
  expect(trackEvent.mock.calls).toEqual([["mcp_expense_added"]]);
  await expect(
    service.createParty({
      requestId: expense.requestId,
      name: "Trip",
      currency: "EUR",
      participants: ["Alice"],
      description: "",
      symbol: "🏝️",
    }),
  ).rejects.toThrow("Invalid write request");
});

it("deduplicates participant additions and counts the completed batch once", async () => {
  const { service, addParticipants, getParty, trackEvent, tokens } = await fixture();

  const input = {
    requestId: (await tokens.prepare("add_participants")).requestId,
    partyId: "party",
    participants: ["Bob", "Carol"],
  };

  await service.addParticipants(input);
  getParty.mockResolvedValueOnce({
    ...view,
    participants: [{ id: "bob", name: "Bob", archived: false, balance: "0.00" }],
  });
  expect(await service.addParticipants(input)).toMatchObject({ participants: [{ id: "bob" }] });
  expect(addParticipants).toHaveBeenCalledTimes(1);
  expect(trackEvent.mock.calls).toEqual([["mcp_participants_added"]]);
  await expect(service.addParticipants({ ...input, participants: ["Dave"] })).rejects.toThrow(
    "different action",
  );
  await expect(
    service.addParticipants({
      ...input,
      requestId: (await tokens.prepare("add_expense")).requestId,
    }),
  ).rejects.toThrow("Invalid write request");
  expect(addParticipants).toHaveBeenCalledTimes(1);
});

it("does not count failed or unconfirmed participant additions", async () => {
  const { service, addParticipants, trackEvent, tokens } = await fixture();

  const input = {
    requestId: (await tokens.prepare("add_participants")).requestId,
    partyId: "party",
    participants: ["Bob"],
  };

  addParticipants.mockRejectedValueOnce(new Error("Sync acknowledgement lost"));
  await expect(service.addParticipants(input)).rejects.toThrow("acknowledgement lost");
  await expect(service.addParticipants(input)).rejects.toThrow("unconfirmed");
  expect(addParticipants).toHaveBeenCalledTimes(1);
  expect(trackEvent).not.toHaveBeenCalled();
});

it("counts successful explicit reads, excludes failures, and ignores analytics errors", async () => {
  const { service, getParty, trackEvent, input } = await fixture();
  await service.getParty("party");
  expect(trackEvent.mock.calls).toEqual([["mcp_party_viewed"]]);
  trackEvent.mockClear();
  getParty.mockRejectedValueOnce(new Error("Missing party"));
  await expect(service.getParty("party")).rejects.toThrow("Missing party");
  expect(trackEvent).not.toHaveBeenCalled();
  trackEvent.mockImplementation(() => {
    throw new Error("Analytics failed");
  });
  await expect(service.createParty(input)).resolves.toEqual(view);
  await expect(service.createParty(input)).resolves.toEqual(view);
  expect(trackEvent).toHaveBeenCalledTimes(1);
});

it("resolves a completed receipt to current Automerge state instead of storing stale group data", async () => {
  const { service, getParty, createParty, trackEvent, input } = await fixture();
  await service.createParty(input);
  getParty.mockResolvedValueOnce({ ...view, name: "Renamed in trizum" });
  expect(await service.createParty(input)).toMatchObject({ name: "Renamed in trizum" });
  expect(createParty).toHaveBeenCalledTimes(1);
  expect(getParty).toHaveBeenCalledWith(view.partyId);
  expect(trackEvent.mock.calls).toEqual([["mcp_party_created"]]);
});

it("deletes expired completed and pending receipts, then refuses old tokens without recreating an action", async () => {
  const { service, createParty, input, tokens, requestKey, advanceTime } = await fixture();
  await service.createParty(input);
  const pending = await tokens.prepare("create_party");
  const pendingKey = await tokens.verify(pending.requestId, "create_party");
  createParty.mockRejectedValueOnce(new Error("Unconfirmed sync"));
  await expect(service.createParty({ ...input, requestId: pending.requestId })).rejects.toThrow(
    "Unconfirmed sync",
  );
  const now = advanceTime(WRITE_WINDOW_MS + 60_000);
  const freshKey = crypto.randomUUID();
  const createdAt = new Date(now).toISOString().slice(0, 19).replace("T", " ");
  await platform.env.DB.prepare(
    "INSERT INTO mcp_operations (request_id, fingerprint, created_at) VALUES (?, ?, ?)",
  )
    .bind(freshKey, "fresh", createdAt)
    .run();
  await cleanupMcpOperations(platform.env.DB, now);

  for (const key of [requestKey, pendingKey]) {
    expect(
      await platform.env.DB.prepare("SELECT request_id FROM mcp_operations WHERE request_id = ?")
        .bind(key)
        .first(),
    ).toBeNull();
  }

  expect(
    await platform.env.DB.prepare("SELECT request_id FROM mcp_operations WHERE request_id = ?")
      .bind(freshKey)
      .first(),
  ).not.toBeNull();
  await expect(service.createParty(input)).rejects.toThrow("expired");
  expect(createParty).toHaveBeenCalledTimes(2);
  expect(
    await platform.env.DB.prepare("SELECT request_id FROM mcp_operations WHERE request_id = ?")
      .bind(requestKey)
      .first(),
  ).toBeNull();

  const plan = await platform.env.DB.prepare(
    "EXPLAIN QUERY PLAN DELETE FROM mcp_operations WHERE created_at < ?",
  )
    .bind(createdAt)
    .all<{ detail: string }>();

  expect(plan.results.some((row) => row.detail.includes("mcp_operations_created_at_idx"))).toBe(
    true,
  );
});

it("rejects forged and rate-limited writes before touching party state", async () => {
  const { service, createParty, input, limitWrite } = await fixture();
  await expect(
    service.createParty({ ...input, requestId: `${input.requestId}tampered` }),
  ).rejects.toThrow("Invalid write request");
  expect(createParty).not.toHaveBeenCalled();
  limitWrite.mockRejectedValueOnce(new Error("Rate limited"));
  await expect(service.createParty(input)).rejects.toThrow("Rate limited");
  expect(createParty).not.toHaveBeenCalled();
});

it("deduplicates every edit/delete operation and emits only its completion event", async () => {
  const f = await fixture();

  const party = {
    requestId: (await f.tokens.prepare("update_party")).requestId,
    partyId: "party",
    name: "Updated",
  };

  const participant = {
    requestId: (await f.tokens.prepare("update_participant")).requestId,
    partyId: "party",
    participantId: "alice",
    archived: true,
  };

  const edit = {
    requestId: (await f.tokens.prepare("update_expense")).requestId,
    partyId: "party",
    expenseId: "expense",
    version: "a".repeat(32),
    amount: "12.00",
  };

  const remove = { ...edit, requestId: (await f.tokens.prepare("delete_expense")).requestId };
  await f.service.updateParty(party);
  await f.service.updateParty(party);
  await f.service.updateParticipant(participant);
  await f.service.updateParticipant(participant);
  await f.service.updateExpense(edit);
  await f.service.updateExpense(edit);
  await f.service.deleteExpense(remove);
  await f.service.deleteExpense(remove);
  expect(f.updateParty).toHaveBeenCalledTimes(1);
  expect(f.updateParticipant).toHaveBeenCalledTimes(1);
  expect(f.updateExpense).toHaveBeenCalledTimes(1);
  expect(f.deleteExpense).toHaveBeenCalledTimes(1);
  expect(f.trackEvent.mock.calls).toEqual([
    ["mcp_party_updated"],
    ["mcp_participant_updated"],
    ["mcp_expense_updated"],
    ["mcp_expense_deleted"],
  ]);
  await expect(f.service.deleteExpense({ ...remove, requestId: edit.requestId })).rejects.toThrow(
    "Invalid write request",
  );
});

it("counts only successful explicit full-expense reads", async () => {
  const f = await fixture();
  await f.service.getExpense({ partyId: "party", expenseId: "expense" });
  expect(f.trackEvent.mock.calls).toEqual([["mcp_expense_viewed"]]);
  f.getExpense.mockRejectedValueOnce(new Error("Missing expense"));
  await expect(f.service.getExpense({ partyId: "party", expenseId: "expense" })).rejects.toThrow(
    "Missing expense",
  );
  expect(f.trackEvent).toHaveBeenCalledTimes(1);
});
