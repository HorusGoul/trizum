import { z } from "zod";
import { partyViewSchema, expenseViewSchema } from "@trizum/mcp/contracts";
import { mcpRoute } from "./routes/mcp";
import { once } from "node:events";
import type { ChangeFn } from "@automerge/automerge";
import { createRequire } from "node:module";
import { generateAutomergeUrl, parseAutomergeUrl, Repo } from "@automerge/automerge-repo";
import { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type * as WebSocketModule from "ws" with { "resolution-mode": "require" };
import type { WebSocketServer } from "ws" with { "resolution-mode": "require" };

import { Hono } from "hono";
import type { ApiEnv, ApiHonoEnv } from "./env";
import { createApiI18nMiddleware } from "./i18n";
import { createPartySharePreviewRoute } from "./routes/party-share-preview";
import { verifyPartyMembership } from "./premium/partyMembership";

import { AutomergeDocuments } from "./automergeDocuments";

import { createAutomergeDocumentsMiddleware } from "./automergeDocumentsMiddleware";
import { WorkerPartyService } from "./mcp/partyService";
import type { Party, PartyExpenseChunk, PartyExpenseChunkBalances } from "../src/models/party";
import {
  calculateBalancesByParticipant,
  calculateExpenseHash,
  createExpenseId,
  type Expense,
} from "../src/models/expense";

// Match the server adapter's CommonJS ws export and bypass the browser alias.
// SAFETY: createRequire resolves the installed ws CommonJS module; WebSocketModule describes that same package export.
const WebSocket = createRequire(import.meta.url)("ws") as typeof WebSocketModule;

describe("Worker document reads over WebSocket", () => {
  let server: Repo | undefined;
  let sockets: WebSocketServer | undefined;

  afterEach(async () => {
    await server?.shutdown();
    server = undefined;
    await new Promise<void>((resolve, reject) => {
      if (!sockets) return resolve();
      sockets.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it.each([0, 1500])(
    "loads membership and previews with a %i ms WebSocket handshake",
    async (delay) => {
      const env = await startServer(delay);

      const party = server!.create({
        type: "party",
        id: "",
        name: "Handshake regression party",
        participants: { member: { id: "member", name: "Member" } },
      });

      party.change((doc) => {
        doc.id = party.documentId;
      });

      const list = server!.create({
        type: "partyList",
        parties: { [party.documentId]: true },
        participantInParties: { [party.documentId]: "member" },
      });

      const documents = new AutomergeDocuments({
        env,
        request: new Request("https://trizum.example.test"),
      });

      try {
        await expect(
          verifyPartyMembership({
            documents,
            partyDocumentId: party.documentId,
            partyListDocumentId: list.documentId,
          }),
        ).resolves.toBe(true);
      } finally {
        await documents.close();
      }

      const app = new Hono<ApiHonoEnv>();
      app.use("*", createApiI18nMiddleware());
      app.route("/", createPartySharePreviewRoute());

      const response = await app.request(
        `https://trizum.example.test/party/${party.documentId}?preview=1`,
        {},
        env,
      );

      expect(response.status).toBe(200);
      expect(await response.text()).toContain("Handshake regression party");
      await vi.waitFor(() => expect(sockets!.clients.size).toBe(0));
    },
  );

  it("shares one lazy repo across concurrent and sequential reads, then isolates the next request", async () => {
    const env = await startServer();
    const first = server!.create({ name: "First" });
    const second = server!.create({ name: "Second" });
    const third = server!.create({ name: "Third" });
    const connections = vi.fn<() => void>();
    sockets!.on("connection", connections);
    const app = new Hono<ApiHonoEnv>();
    app.use("*", createAutomergeDocumentsMiddleware());
    app.use("*", createAutomergeDocumentsMiddleware());
    app.get("/", async (c) => {
      const documents = c.get("documents");

      const pair = await Promise.all([
        documents.read<{ name: string }>(first.documentId),
        documents.read<{ name: string }>(second.documentId),
      ]);

      const later = await documents.read<{ name: string }>(third.documentId);
      const again = await documents.read<{ name: string }>(first.documentId);

      return c.json([...pair.map((doc) => doc.name), later.name, again.name]);
    });

    for (let request = 1; request <= 2; request++) {
      const response = await app.request("https://trizum.example.test", {}, env);
      expect(await response.json()).toEqual(["First", "Second", "Third", "First"]);
      expect(connections).toHaveBeenCalledTimes(request);
      await vi.waitFor(() => expect(sockets!.clients.size).toBe(0));
    }
  });

  it("closes the shared repo when a downstream handler fails", async () => {
    const env = await startServer();
    const party = server!.create({ name: "Party" });
    const app = new Hono<ApiHonoEnv>();
    app.use("*", createAutomergeDocumentsMiddleware());
    app.onError((_error, c) => c.text("Expected failure", 500));
    app.get("/", async (c) => {
      await c.get("documents").read(party.documentId);
      throw new Error("Handler failed");
    });
    const response = await app.request("https://trizum.example.test", {}, env);
    expect(response.status).toBe(500);
    await vi.waitFor(() => expect(sockets!.clients.size).toBe(0));
  });

  it("waits for sync acknowledgement so writes survive closing the Worker request", async () => {
    const env = await startServer();
    const first = server!.create({ value: 0 });
    const second = server!.create({ value: 0 });

    const documents = new AutomergeDocuments({
      env,
      request: new Request("https://trizum.example.test"),
    });

    try {
      await Promise.all([
        documents.change<{ value: number }>(first.documentId, (doc) => {
          doc.value = 1;
        }),
        documents.change<{ value: number }>(second.documentId, (doc) => {
          doc.value = 2;
        }),
      ]);
      expect(first.doc().value).toBe(1);
      expect(second.doc().value).toBe(2);
    } finally {
      await documents.close();
    }

    const next = new AutomergeDocuments({
      env,
      request: new Request("https://trizum.example.test"),
    });

    try {
      expect(await next.read(first.documentId)).toMatchObject({ value: 1 });
      expect(await next.read(second.documentId)).toMatchObject({ value: 2 });
    } finally {
      await next.close();
    }
  });

  it("creates, lists and removes repeated expenses over HTTP without D1, tokens or preparation", async () => {
    const env = await startServer();
    const limit = vi.fn<RateLimit["limit"]>().mockResolvedValue({ success: true });
    const app = new Hono<ApiHonoEnv>();
    app.use("*", createApiI18nMiddleware());
    app.route("/api/mcp", mcpRoute);
    const bindings = { ...env, MCP_WRITE_LIMITER: { limit } };
    let requestNumber = 0;

    async function call<T>(
      name: string,
      input: Record<string, string | string[]>,
      schema: z.ZodType<T>,
    ) {
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
            id: ++requestNumber,
            method: "tools/call",
            params: { name, arguments: input },
          }),
        },
        bindings,
      );

      expect(response.status).toBe(200);

      const body = z
        .object({
          result: z.object({ isError: z.boolean().optional(), structuredContent: schema }),
        })
        .parse(await response.json());

      expect(body.result.isError).not.toBe(true);

      return body.result.structuredContent;
    }

    const input = { name: "Direct MCP", currency: "EUR", participants: ["Test Alex", "Test Sam"] };
    const first = await call("create_party", input, partyViewSchema);
    const second = await call("create_party", input, partyViewSchema);
    expect(first.partyId).not.toBe(second.partyId);

    const expense = {
      partyId: first.partyId,
      name: "Dinner",
      amount: "48.00",
      paidAt: "2026-11-08T20:00:00Z",
      paidBy: first.participants[0].id,
      splitBetween: first.participants.map((person) => person.id),
    };

    await call("add_expense", expense, partyViewSchema);
    await call("add_expense", expense, partyViewSchema);
    const duplicated = await call("get_party", { partyId: first.partyId }, partyViewSchema);
    expect(duplicated.expenses).toHaveLength(2);
    expect(duplicated.expenses.map((entry) => entry.name)).toEqual(["Dinner", "Dinner"]);
    const target = { partyId: first.partyId, expenseId: duplicated.expenses[0].id };
    const full = await call("get_expense", target, expenseViewSchema);
    await call("delete_expense", { ...target, version: full.version }, partyViewSchema);
    const cleaned = await call("get_party", { partyId: first.partyId }, partyViewSchema);
    expect(cleaned.expenses).toHaveLength(1);
    expect(cleaned.participants.map((person) => person.balance)).toEqual(["24.00", "-24.00"]);
    expect(limit).toHaveBeenCalledTimes(5);
  });

  it("creates agent parties and expenses that survive Worker cleanup with correct shared balances", async () => {
    const env = await startServer();
    const documents = new AutomergeDocuments({ env, request: new Request("https://trizum.app") });
    const service = new WorkerPartyService(documents, "https://trizum.app");

    const party = await service.createParty({
      name: "Weekend",
      currency: "EUR",
      participants: ["Alice", "Bob", "Carol"],
      description: "",
      symbol: "🏝️",
    });

    const [alice, bob, carol] = party.participants;
    expect(party.url).toBe(
      `https://trizum.app/party/${party.partyId}?entry=ai&utm_source=mcp&utm_medium=ai_app&utm_campaign=party_handoff`,
    );

    const expenseInput = {
      partyId: party.partyId,
      name: "Dinner",
      amount: "10.00",
      paidBy: alice.id,
      splitBetween: [alice.id, bob.id, carol.id],
      paidAt: "2026-11-05T20:00:00Z",
    };

    try {
      await expect(service.addExpense({ ...expenseInput, paidBy: "stranger" })).rejects.toThrow(
        "active participant",
      );
      await expect(
        service.addExpense({ ...expenseInput, splitBetween: [alice.id, alice.id] }),
      ).rejects.toThrow("only once");
      await expect(service.addExpense({ ...expenseInput, amount: "0.00" })).rejects.toThrow(
        "positive",
      );
      const result = await service.addExpense(expenseInput);
      expect(result.expenses).toHaveLength(1);
      expect(result.expenses[0]).toMatchObject({ name: "Dinner", amount: "10.00" });
      expect(result.participants.map((person) => person.balance)).toEqual([
        "6.66",
        "-3.33",
        "-3.33",
      ]);
      // SAFETY: A created PartyView's partyId comes directly from Repo.create.
      const persisted = await documents.read<Party>(party.partyId as Party["id"]);

      const balances = await documents.read<PartyExpenseChunkBalances>(
        persisted.chunkRefs[0].balancesId,
      );

      expect(balances.balances[alice.id].stats.balance).toBe(666);
      expect(server!.handles[persisted.chunkRefs[0].chunkId]?.doc()).toMatchObject({
        expenses: [{ __hash: expect.stringMatching(/^[a-f0-9]{32}$/) }],
      });
    } finally {
      await documents.close();
    }

    const next = new AutomergeDocuments({ env, request: new Request("https://trizum.app") });

    try {
      const recovered = await new WorkerPartyService(next, "https://trizum.app").getParty(
        party.partyId,
      );

      expect(recovered.expenses).toHaveLength(1);
      expect(recovered.participants.map((person) => person.balance)).toEqual([
        "6.66",
        "-3.33",
        "-3.33",
      ]);
    } finally {
      await next.close();
    }
  });

  it("adds people for later expenses without changing previous splits or allowing duplicate batches", async () => {
    const env = await startServer();
    const documents = new AutomergeDocuments({ env, request: new Request("https://trizum.app") });
    const service = new WorkerPartyService(documents, "https://trizum.app");
    let partyId: string;

    try {
      const party = await service.createParty({
        name: "Growing group",
        currency: "EUR",
        participants: ["Alice", "Bob"],
        description: "",
        symbol: "🏝️",
      });

      partyId = party.partyId;
      await service.addExpense({
        partyId,
        name: "First dinner",
        amount: "2.00",
        paidBy: party.participants.find((person) => person.name === "Alice")!.id,
        splitBetween: party.participants.map((person) => person.id),
        paidAt: "2026-11-06T20:00:00Z",
      });
      await expect(
        service.addParticipants({
          partyId,
          participants: ["Carol", " alice "],
        }),
      ).rejects.toThrow("already exists");
      await expect(
        service.addParticipants({
          partyId,
          participants: ["Carol", "carol"],
        }),
      ).rejects.toThrow("already exists");
      expect(
        (await service.getParty(partyId)).participants.map((person) => person.name).sort(),
      ).toEqual(["Alice", "Bob"]);

      const added = await service.addParticipants({
        partyId,
        participants: ["Carol"],
      });

      expect(
        Object.fromEntries(added.participants.map((person) => [person.name, person.balance])),
      ).toEqual({ Alice: "1.00", Bob: "-1.00", Carol: "0.00" });
      expect(added.participants.map((person) => person.id)).toEqual(
        expect.arrayContaining(party.participants.map((person) => person.id)),
      );
      const carol = added.participants.find((person) => person.name === "Carol")!;

      const expense = await service.addExpense({
        partyId,
        name: "Carol's dinner",
        amount: "6.00",
        paidBy: carol.id,
        splitBetween: added.participants.map((person) => person.id),
        paidAt: "2026-11-07T20:00:00Z",
      });

      expect(
        Object.fromEntries(expense.participants.map((person) => [person.name, person.balance])),
      ).toEqual({ Alice: "-1.00", Bob: "-3.00", Carol: "4.00" });
      await expect(
        service.addParticipants({
          partyId,
          participants: Array.from({ length: 48 }, (_, index) => `Person ${index}`),
        }),
      ).rejects.toThrow("too many participants");
    } finally {
      await documents.close();
    }

    const next = new AutomergeDocuments({ env, request: new Request("https://trizum.app") });

    try {
      const refreshed = await new WorkerPartyService(next, "https://trizum.app").getParty(partyId!);
      expect(refreshed.participants.map((person) => person.name).sort()).toEqual([
        "Alice",
        "Bob",
        "Carol",
      ]);
      expect(
        Object.fromEntries(refreshed.participants.map((person) => [person.name, person.balance])),
      ).toEqual({ Alice: "-1.00", Bob: "-3.00", Carol: "4.00" });
      expect(refreshed.expenses).toHaveLength(2);
    } finally {
      await next.close();
    }
  });

  it("merges participant additions from independent requests without replacing existing people", async () => {
    const env = await startServer();
    const initial = new AutomergeDocuments({ env, request: new Request("https://trizum.app") });

    const party = await new WorkerPartyService(initial, "https://trizum.app").createParty({
      name: "Concurrent additions",
      currency: "EUR",
      participants: ["Alice"],
      description: "",
      symbol: "🏝️",
    });

    await initial.close();

    const writers = [0, 1].map(
      () => new AutomergeDocuments({ env, request: new Request("https://trizum.app") }),
    );

    try {
      // Both requests start from the same party state, as separate edge invocations do.
      // SAFETY: Repo.create allocated this party ID.
      await Promise.all(
        writers.map((documents) => documents.read<Party>(party.partyId as Party["id"])),
      );
      await Promise.all(
        writers.map((documents, index) =>
          new WorkerPartyService(documents, "https://trizum.app").addParticipants({
            partyId: party.partyId,
            participants: [index === 0 ? "Bob" : "Carol"],
          }),
        ),
      );
    } finally {
      await Promise.all(writers.map((documents) => documents.close()));
    }

    const next = new AutomergeDocuments({ env, request: new Request("https://trizum.app") });

    try {
      const refreshed = await new WorkerPartyService(next, "https://trizum.app").getParty(
        party.partyId,
      );

      expect(refreshed.participants.map((person) => person.name).sort()).toEqual([
        "Alice",
        "Bob",
        "Carol",
      ]);
      expect(refreshed.participants.find((person) => person.name === "Alice")).toEqual(
        party.participants[0],
      );
    } finally {
      await next.close();
    }
  });

  it("preserves every expense and shared balance across concurrent independent MCP writers", async () => {
    const env = await startServer();
    const request = () => new Request("https://trizum.app");
    const initial = new AutomergeDocuments({ env, request: request() });
    const service = new WorkerPartyService(initial, "https://trizum.app");

    const party = await service.createParty({
      name: "Concurrent expenses",
      currency: "EUR",
      participants: ["Alice", "Bob"],
      description: "",
      symbol: "🏝️",
    });

    const expense = (amount: string) => ({
      partyId: party.partyId,
      name: "Dinner",
      amount,
      paidBy: party.participants[0].id,
      splitBetween: party.participants.map((person) => person.id),
      paidAt: "2026-11-06T20:00:00Z",
    });

    await service.addExpense(expense("2.00"));
    await initial.close();

    const writers = [0, 1].map(() => new AutomergeDocuments({ env, request: request() }));
    // Delay the first balance publication until a second independent write finishes.
    let release!: () => void;

    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });

    let reached!: (overwrites: boolean) => void;

    const publishing = new Promise<boolean>((resolve) => {
      reached = resolve;
    });

    // SAFETY: Repo.create allocated the party ID returned above.
    const stored = await writers[0].read<Party>(party.partyId as Party["id"]);
    const originalBalanceId = stored.chunkRefs[0].balancesId;

    const firstDocuments = {
      find: writers[0].find.bind(writers[0]),
      fork: writers[0].fork.bind(writers[0]),
      read: writers[0].read.bind(writers[0]),
      async create<T extends object>(initialize: (id: Party["id"]) => T) {
        const doc = await writers[0].create(initialize);

        if ("type" in doc && doc.type === "expenseChunkBalances") {
          reached(false);
          await delayed;
        }

        return doc;
      },
      async change<T>(id: Party["id"], change: ChangeFn<T>) {
        if (id === originalBalanceId) {
          reached(true);
          await delayed;
        }

        return writers[0].change(id, change);
      },
    };

    const firstWrite = new WorkerPartyService(firstDocuments, "https://trizum.app").addExpense(
      expense("10.00"),
    );

    try {
      const overwrites = await publishing;
      await new WorkerPartyService(writers[1], "https://trizum.app").addExpense(expense("20.00"));

      if (overwrites) {
        await vi.waitFor(async () => {
          const balances = await writers[0].read<PartyExpenseChunkBalances>(originalBalanceId);

          if (balances.balances[party.participants[0].id].stats.balance !== 1600)
            throw new Error("Waiting for the second writer's balance publication");
        });
      }
    } finally {
      release();

      try {
        await firstWrite;
      } finally {
        await Promise.all(writers.map((documents) => documents.close()));
      }
    }

    const reader = new AutomergeDocuments({ env, request: request() });

    try {
      const result = await new WorkerPartyService(reader, "https://trizum.app").getParty(
        party.partyId,
      );

      expect(result.expenses).toHaveLength(3);
      expect(result.participants.map((person) => person.balance)).toEqual(["16.00", "-16.00"]);
      // Inspect exactly the shared documents the PWA consumes, without a recalculation client.
      // SAFETY: Repo.create allocated the party ID returned above.
      const persisted = await reader.read<Party>(party.partyId as Party["id"]);

      const balances = await Promise.all(
        persisted.chunkRefs.map((ref) => reader.read<PartyExpenseChunkBalances>(ref.balancesId)),
      );

      const total = balances.reduce(
        (sum, doc) => sum + doc.balances[party.participants[0].id].stats.balance,
        0,
      );

      expect(total).toBe(1600);
      expect(new Set(persisted.chunkRefs.map((ref) => ref.balancesId)).size).toBe(3);
    } finally {
      await reader.close();
    }
  });

  it("syncs shared balances and recent expenses on demand without fetching unused history", async () => {
    const env = await startServer();
    const documents = new AutomergeDocuments({ env, request: new Request("https://trizum.app") });
    const service = new WorkerPartyService(documents, "https://trizum.app");

    try {
      const created = await service.createParty({
        name: "Long-running group",
        currency: "EUR",
        participants: ["Alice", "Bob"],
        description: "",
        symbol: "🏝️",
      });

      const [alice, bob] = created.participants;
      // SAFETY: The created party ID is allocated by Repo.create.
      const partyId = created.partyId as Party["id"];
      const party = await documents.read<Party>(partyId);

      const chunk = await documents.create<PartyExpenseChunk>((id) => ({
        id,
        type: "expenseChunk",
        partyId,
        createdAt: new Date(),
        maxSize: 500,
        expenses: Array.from({ length: 20 }, () => {
          const expense: Expense = {
            id: createExpenseId(id),
            name: "Dinner",
            paidAt: new Date(),
            paidBy: { [alice.id]: 100 },
            shares: {
              [alice.id]: { type: "divide", value: 1 },
              [bob.id]: { type: "divide", value: 1 },
            },
            photos: [],
            __hash: "",
          };

          expense.__hash = calculateExpenseHash(expense);

          return expense;
        }),
      }));

      const summary = await documents.create<PartyExpenseChunkBalances>((id) => ({
        id,
        type: "expenseChunkBalances",
        partyId,
        balances: calculateBalancesByParticipant(chunk.expenses, party.participants),
      }));

      const historicalSummary = await documents.create<PartyExpenseChunkBalances>((id) => ({
        id,
        type: "expenseChunkBalances",
        partyId,
        balances: {},
      }));

      // Deliberately unavailable: touching this history would fail the request.
      const historicalChunkId = parseAutomergeUrl(generateAutomergeUrl()).documentId;
      await documents.change<Party>(partyId, (doc) => {
        doc.chunkRefs = [
          { chunkId: chunk.id, balancesId: summary.id, createdAt: chunk.createdAt },
          { chunkId: historicalChunkId, balancesId: historicalSummary.id, createdAt: new Date(0) },
        ];
      });
      const result = await service.getParty(partyId);
      expect(result.expenses).toHaveLength(20);
      expect(result.participants.map((person) => person.balance)).toEqual(["10.00", "-10.00"]);

      const updated = await service.addExpense({
        partyId,
        name: "Lunch",
        amount: "4.00",
        paidBy: alice.id,
        splitBetween: [alice.id, bob.id],
        paidAt: "2026-11-05T12:00:00Z",
      });

      expect(updated.expenses).toHaveLength(20);
      expect(updated.participants.map((person) => person.balance)).toEqual(["12.00", "-12.00"]);
      await documents.close();

      // Simulate edits from another client between two independent MCP requests.
      const liveParty = await server!.find<Party>(partyId);
      liveParty.change((doc) => {
        doc.name = "Updated in trizum";
      });
      const updatedParty = (await server!.find<Party>(partyId)).doc();
      const lunchRef = updatedParty.chunkRefs[0];
      const liveChunk = await server!.find<PartyExpenseChunk>(lunchRef.chunkId);
      liveChunk.change((doc) => {
        const expense = doc.expenses.find((entry) => entry.name === "Lunch")!;
        expense.name = "Updated lunch";
        expense.paidBy[alice.id] = 1200;
        expense.__hash = calculateExpenseHash(expense);
      });
      const liveBalances = await server!.find<PartyExpenseChunkBalances>(lunchRef.balancesId);
      liveBalances.change((doc) => {
        doc.balances = calculateBalancesByParticipant(liveChunk.doc().expenses, party.participants);
      });
      const next = new AutomergeDocuments({ env, request: new Request("https://trizum.app") });

      try {
        const refreshed = await new WorkerPartyService(next, "https://trizum.app").getParty(
          partyId,
        );

        expect(refreshed.name).toBe("Updated in trizum");
        expect(refreshed.expenses).toContainEqual(
          expect.objectContaining({ name: "Updated lunch", amount: "12.00" }),
        );
        expect(refreshed.participants.map((person) => person.balance)).toEqual(["16.00", "-16.00"]);
        const api = new WorkerPartyService(next, "https://trizum.app");

        const expense = await api.getExpense({
          partyId,
          expenseId: liveChunk.doc().expenses[0].id,
        });

        const renamed = await api.updateExpense({
          partyId,
          expenseId: expense.expenseId,
          version: expense.version,
          name: "Renamed through MCP",
        });

        expect(renamed.expenses).toContainEqual(
          expect.objectContaining({ name: "Renamed through MCP", amount: "12.00" }),
        );
        expect(renamed.participants.map((person) => person.balance)).toEqual(["16.00", "-16.00"]);
        expect((await next.read<Party>(partyId)).chunkRefs).toHaveLength(3);
      } finally {
        await next.close();
      }
    } finally {
      await documents.close();
    }
  });

  it("returns a recovery link without confirming a party whose creation acknowledgement is lost", async () => {
    const env = await startServer();
    const probe = server!.create({ value: 0 });

    const documents = new AutomergeDocuments({
      env,
      request: new Request("https://trizum.app"),
      timeoutMs: "500",
    });

    try {
      await documents.read(probe.documentId);

      for (const socket of sockets!.clients) socket.removeAllListeners("message");
      const api = new WorkerPartyService(documents, "https://trizum.app");
      await expect(
        api.createParty({
          name: "Lost acknowledgement",
          currency: "EUR",
          description: "",
          symbol: "🌉",
          participants: ["Test Alex", "Test Sam"],
        }),
      ).rejects.toThrow(/Party creation could not be confirmed.*https:\/\/trizum\.app\/party\//);
    } finally {
      await documents.close();
    }
  });

  it("rejects a write when the sync peer never acknowledges it", async () => {
    const env = await startServer();
    const party = server!.create({ value: 0 });

    const documents = new AutomergeDocuments({
      env,
      request: new Request("https://trizum.example.test"),
      timeoutMs: "500",
    });

    try {
      await documents.read(party.documentId);

      for (const socket of sockets!.clients) socket.removeAllListeners("message");
      await expect(
        documents.change<{ value: number }>(party.documentId, (doc) => {
          doc.value = 1;
        }),
      ).rejects.toMatchObject({ name: "AbortError" });
      expect(party.doc().value).toBe(0);
    } finally {
      await documents.close();
    }
  });

  it.each(["timeout", "request abort"])(
    "closes a connection that never advertises a sync peer on %s",
    async (reason) => {
      const env = await startServer(0, false);
      const controller = new AbortController();
      // The client's join proves it has processed the HTTP upgrade too.
      const connected = once(sockets!, "connection").then(([socket]) => once(socket, "message"));

      const documents = new AutomergeDocuments({
        env,
        request: new Request("https://trizum.example.test", { signal: controller.signal }),
        timeoutMs: reason === "timeout" ? "200" : "5000",
      });

      const reading = documents.read(parseAutomergeUrl(generateAutomergeUrl()).documentId);

      try {
        await Promise.all([
          expect(reading).rejects.toMatchObject({ name: "AbortError" }),
          connected.then(() => {
            if (reason === "request abort") controller.abort();
          }),
        ]);
      } finally {
        await documents.close();
      }

      await vi.waitFor(() => expect(sockets!.clients.size).toBe(0));
    },
  );

  async function startServer(delay = 0, sync = true) {
    sockets = new WebSocket.Server({
      port: 0,
      verifyClient: (_info, done) => {
        setTimeout(() => done(true), delay);
      },
    });

    if (sync) {
      server = new Repo({
        network: [new NodeWSServerAdapter(sockets)],
        sharePolicy: async () => false,
      });
    }

    await once(sockets, "listening");
    const address = sockets.address();

    if (!address || !(address instanceof Object)) throw new Error("Expected a local TCP server");

    const assets: Pick<ApiEnv["ASSETS"], "fetch"> = {
      fetch: async () =>
        new Response("<html><head><title>Fallback</title></head><body></body></html>"),
    };

    // SAFETY: These preview and membership routes use the configured sync URL, timeouts, and asset fetcher only.
    return {
      AUTOMERGE_WSS_URL: `ws://127.0.0.1:${address.port}`,
      PARTY_MEMBERSHIP_TIMEOUT_MS: "5000",
      PARTY_SHARE_PREVIEW_TIMEOUT_MS: "5000",
      ASSETS: assets,
    } as ApiEnv;
  }
});
