import { describe, expect, test, vi } from "vite-plus/test";
import type { AuthSecretStore } from "jazz-tools";
import {
  createTrizumFateClient,
  ExpenseListItemView,
  PartySummaryView,
  projectEntity,
  resolveJazzFateAuthConfig,
  trizumJazzWasmSchema,
  type ExpenseEntity,
  type JazzFateRepository,
  type JazzFateRepositoryListResult,
  type ParticipantEntity,
  type PartyEntity,
  type TrizumFateEntity,
  type TrizumFateListRoot,
  type TrizumFateTypename,
} from "./index";

describe("Jazz Fate auth", () => {
  test("defaults product-local users to Jazz local-first auth", async () => {
    const secretStore = {
      clearSecret: vi.fn<() => Promise<void>>(async () => {}),
      getOrCreateSecret: vi.fn<() => Promise<string>>(async () => "local-first-secret"),
      loadSecret: vi.fn<() => Promise<string | null>>(async () => null),
      saveSecret: vi.fn<(secret: string) => Promise<void>>(async (_secret) => {}),
    } satisfies AuthSecretStore;

    await expect(
      resolveJazzFateAuthConfig("trizum-test", {
        secretStore,
      }),
    ).resolves.toStrictEqual({
      secret: "local-first-secret",
    });

    expect(secretStore.getOrCreateSecret).toHaveBeenCalledTimes(1);
  });

  test("keeps Jazz anonymous mode explicit for guest/read-limited sessions", async () => {
    await expect(
      resolveJazzFateAuthConfig("trizum-test", {
        mode: "anonymousGuest",
      }),
    ).resolves.toStrictEqual({});
  });
});

describe("Jazz alpha schema", () => {
  test("compiles privacy-aware row policies into the Jazz wasm schema", () => {
    expect(trizumJazzWasmSchema.parties?.policies?.select?.using).toMatchObject({
      type: "Or",
    });
    expect(trizumJazzWasmSchema.expenses?.policies?.select?.using).toStrictEqual({
      operation: "Select",
      type: "Inherits",
      via_column: "partyId",
    });
    expect(trizumJazzWasmSchema.expenses?.policies?.update?.using).toStrictEqual({
      operation: "Update",
      type: "Inherits",
      via_column: "partyId",
    });
  });
});

describe("Fate masking over Jazz entities", () => {
  test("uses the exact Fate request and view API to mask sensitive fields", async () => {
    const repository = createMemoryRepository();
    const client = createTrizumFateClient({ repository });

    const { party } = await client.request({
      party: {
        id: "party-1",
        view: PartySummaryView,
      },
    });
    const snapshot = await client.readView(PartySummaryView, party);

    expect(repository.fetches.at(0)).toMatchObject({
      ids: ["party-1"],
      select: expect.arrayContaining(["id", "name", "symbol", "currency"]),
      type: "Party",
    });
    expect(snapshot.data).toMatchObject({
      __typename: "Party",
      currency: "EUR",
      id: "party-1",
      name: "Lisbon trip",
      symbol: "LX",
    });
    expect(Object.hasOwn(snapshot.data, "localOnlyInviteSecret")).toBe(false);
  });

  test("projects mutation payloads to the Fate view selection", async () => {
    const repository = createMemoryRepository();
    const client = createTrizumFateClient({ repository });

    const created = await client.mutations.expense.create({
      input: {
        amount: 42_00,
        internalMemo: "private reimbursement note",
        isTransfer: false,
        name: "Dinner",
        paidAt: new Date("2026-06-10T20:30:00.000Z"),
        paidBy: { alice: 42_00 },
        partyId: "party-1",
        photos: [],
        shares: { alice: { type: "divide", value: 1 } },
      },
      view: ExpenseListItemView,
    });

    if (created.error) {
      throw created.error;
    }

    expect(repository.expenses.at(-1)?.internalMemo).toBe("private reimbursement note");
    expect(created.result).toMatchObject({
      __typename: "Expense",
      amount: 42_00,
      name: "Dinner",
      partyId: "party-1",
    });
    expect(Object.hasOwn(created.result, "internalMemo")).toBe(false);
  });

  test("exposes list roots through Fate while preserving per-view masking", async () => {
    const repository = createMemoryRepository();
    const client = createTrizumFateClient({ repository });

    const { expenses } = await client.request({
      expenses: {
        args: { partyId: "party-1" },
        list: ExpenseListItemView,
      },
    });

    const [expenseRef] = expenses;
    expect(expenseRef).toBeDefined();

    const snapshot = await client.readView(ExpenseListItemView, expenseRef!);

    expect(repository.lists.at(0)).toMatchObject({
      args: { partyId: "party-1" },
      root: "expenses",
      select: expect.arrayContaining(["id", "name", "amount", "partyId"]),
    });
    expect(snapshot.data).toMatchObject({
      __typename: "Expense",
      amount: 12_50,
      id: "expense-1",
      name: "Coffee",
      partyId: "party-1",
    });
    expect(Object.hasOwn(snapshot.data, "internalMemo")).toBe(false);
  });
});

function createMemoryRepository() {
  const parties: PartyEntity[] = [
    {
      __typename: "Party",
      currency: "EUR",
      description: "Shared travel expenses",
      id: "party-1",
      localOnlyInviteSecret: "invite-secret",
      name: "Lisbon trip",
      ownerUserId: "alice-local-first",
      symbol: "LX",
    },
  ];
  const participants: ParticipantEntity[] = [
    {
      __typename: "Participant",
      avatarId: null,
      id: "participant-1",
      isArchived: false,
      name: "Alice",
      partyId: "party-1",
      personalMode: false,
      phone: "+15550000000",
    },
  ];
  const expenses: ExpenseEntity[] = [
    {
      __typename: "Expense",
      amount: 12_50,
      id: "expense-1",
      internalMemo: "receipt has tax id",
      isTransfer: false,
      name: "Coffee",
      paidAt: new Date("2026-06-10T09:15:00.000Z"),
      paidBy: { alice: 12_50 },
      partyId: "party-1",
      photos: [],
      shares: { alice: { type: "divide", value: 1 } },
    },
  ];

  const repository: JazzFateRepository & {
    expenses: ExpenseEntity[];
    fetches: Array<{
      args?: Record<string, unknown>;
      ids: Array<string | number>;
      select: string[];
      type: TrizumFateTypename;
    }>;
    lists: Array<{
      args?: Record<string, unknown>;
      root: TrizumFateListRoot;
      select: string[];
    }>;
  } = {
    expenses,
    fetches: [],
    lists: [],

    async fetchEntities(type, ids, select, args) {
      repository.fetches.push({ args, ids, select: [...select], type });
      return ids.map((id) => {
        const entity = tableFor(type).find((candidate) => candidate.id === String(id));
        return entity ? projectEntity(entity, select) : null;
      });
    },

    async fetchList(root, select, args) {
      repository.lists.push({ args, root, select: [...select] });

      const type = typeForRoot(root);
      const rows = tableFor(type).filter(
        (entity) =>
          typeof args?.partyId !== "string" ||
          !("partyId" in entity) ||
          entity.partyId === args.partyId,
      );

      return {
        items: rows.map((entity) => {
          const node = projectEntity(entity, select);

          return {
            cursor: node.id,
            node,
          };
        }),
        pagination: {
          hasNext: false,
          hasPrevious: false,
        },
      } satisfies JazzFateRepositoryListResult;
    },

    async createParty(input, select) {
      const party: PartyEntity = {
        __typename: "Party",
        ...input,
        currency: input.currency ?? "EUR",
        description: input.description ?? "",
        id: nextId("party", parties.length),
        localOnlyInviteSecret: input.localOnlyInviteSecret ?? null,
        symbol: input.symbol ?? null,
      };
      parties.push(party);
      return projectEntity(party, select);
    },

    async createParticipant(input, select) {
      const participant: ParticipantEntity = {
        __typename: "Participant",
        ...input,
        avatarId: input.avatarId ?? null,
        id: nextId("participant", participants.length),
        isArchived: input.isArchived ?? false,
        personalMode: input.personalMode ?? false,
        phone: input.phone ?? null,
      };
      participants.push(participant);
      return projectEntity(participant, select);
    },

    async createExpense(input, select) {
      const expense: ExpenseEntity = {
        __typename: "Expense",
        ...input,
        id: nextId("expense", expenses.length),
        internalMemo: input.internalMemo ?? null,
        isTransfer: input.isTransfer ?? false,
        paidBy: input.paidBy ?? {},
        photos: input.photos ?? [],
        shares: input.shares ?? {},
      };
      expenses.push(expense);
      return projectEntity(expense, select);
    },
  };

  function tableFor(type: TrizumFateTypename): TrizumFateEntity[] {
    switch (type) {
      case "Party":
        return parties;
      case "Participant":
        return participants;
      case "Expense":
        return expenses;
    }
  }

  return repository;
}

function typeForRoot(root: TrizumFateListRoot): TrizumFateTypename {
  switch (root) {
    case "parties":
      return "Party";
    case "participants":
      return "Participant";
    case "expenses":
      return "Expense";
  }
}

function nextId(prefix: string, count: number) {
  return `${prefix}-${count + 1}`;
}
