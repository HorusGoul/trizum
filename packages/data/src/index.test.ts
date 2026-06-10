import { describe, expect, test } from "vite-plus/test";
import {
  createTrizumFateClient,
  ExpenseListItemView,
  MediaFileMetadataView,
  PartySummaryView,
  projectTrizumEntity,
  trizumEntityDefinitions,
  trizumJazzWasmSchema,
  trizumListDefinitions,
  UserSettingsView,
  type CreateExpenseMutationInput,
  type CreateParticipantMutationInput,
  type CreatePartyMutationInput,
  type ExpenseChunkBalancesEntity,
  type ExpenseChunkEntity,
  type ExpenseEntity,
  type MediaFileEntity,
  type PartyMemberEntity,
  type ParticipantEntity,
  type PartyEntity,
  type TrizumDataRepository,
  type TrizumDataRepositoryListResult,
  type TrizumFateEntity,
  type TrizumFateListRoot,
  type TrizumFateTypename,
  type UserEntity,
  type UserPartyStateEntity,
} from "./index.js";

describe("Jazz alpha schema", () => {
  test("compiles privacy-aware row policies into the Jazz wasm schema", () => {
    expect(trizumJazzWasmSchema.users?.policies?.select?.using).toStrictEqual({
      column: "id",
      op: "Eq",
      type: "Cmp",
      value: {
        path: ["userId"],
        type: "SessionRef",
      },
    });
    expect(trizumJazzWasmSchema.parties?.policies?.select?.using).toMatchObject({
      type: "Or",
    });
    expect(trizumJazzWasmSchema.mediaFiles?.policies?.select?.using).toMatchObject({
      type: "Or",
    });
    expect(trizumJazzWasmSchema.expenseChunks?.policies?.select?.using).toStrictEqual({
      operation: "Select",
      type: "Inherits",
      via_column: "partyId",
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

describe("Trizum Jazz model surface", () => {
  test("extracts the PWA data boundaries into entity definitions", () => {
    expect(trizumEntityDefinitions.map((definition) => definition.type)).toStrictEqual([
      "User",
      "Party",
      "PartyMember",
      "UserPartyState",
      "Participant",
      "MediaFile",
      "ExpenseChunk",
      "ExpenseChunkBalances",
      "Expense",
    ]);
    expect(trizumListDefinitions.map((definition) => definition.root)).toStrictEqual([
      "users",
      "parties",
      "partyMembers",
      "userPartyStates",
      "participants",
      "mediaFiles",
      "expenseChunks",
      "expenseChunkBalances",
      "expenses",
    ]);
  });
});

describe("Fate masking over Trizum Jazz entities", () => {
  test("models a user while masking account identifiers from settings views", async () => {
    const repository = createMemoryRepository();
    const client = createTrizumFateClient({ repository });

    const { user } = await client.request({
      user: {
        id: "alice-local-first",
        view: UserSettingsView,
      },
    });
    const snapshot = await client.readView(UserSettingsView, user);

    expect(snapshot.data).toMatchObject({
      __typename: "User",
      authMode: "localFirst",
      autoOpenCalculator: true,
      displayName: "Alice",
      id: "alice-local-first",
      locale: "en",
      openLastPartyOnLaunch: false,
    });
    expect(Object.hasOwn(snapshot.data, "fullAccountUserId")).toBe(false);
  });

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

  test("exposes media metadata without loading encoded blobs", async () => {
    const repository = createMemoryRepository();
    const client = createTrizumFateClient({ repository });

    const { mediaFiles } = await client.request({
      mediaFiles: {
        args: { partyId: "party-1" },
        list: MediaFileMetadataView,
      },
    });
    const [mediaFileRef] = mediaFiles;
    expect(mediaFileRef).toBeDefined();

    const snapshot = await client.readView(MediaFileMetadataView, mediaFileRef!);

    expect(snapshot.data).toMatchObject({
      __typename: "MediaFile",
      id: "media-1",
      metadata: {
        mimeType: "image/jpeg",
      },
      ownerUserId: "alice-local-first",
      partyId: "party-1",
    });
    expect(Object.hasOwn(snapshot.data, "encodedBlob")).toBe(false);
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
  const users: UserEntity[] = [
    {
      __typename: "User",
      accountProvider: null,
      authMode: "localFirst",
      autoOpenCalculator: true,
      avatarId: "media-1",
      displayName: "Alice",
      fullAccountUserId: "account-provider-user-id",
      hue: 250,
      id: "alice-local-first",
      lastOpenedPartyId: "party-1",
      locale: "en",
      openLastPartyOnLaunch: false,
      phone: "+15550000000",
    },
  ];
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
  const partyMembers: PartyMemberEntity[] = [
    {
      __typename: "PartyMember",
      id: "party-member-1",
      participantId: "participant-1",
      partyId: "party-1",
      role: "owner",
      userId: "alice-local-first",
    },
  ];
  const userPartyStates: UserPartyStateEntity[] = [
    {
      __typename: "UserPartyState",
      id: "user-party-state-1",
      isArchived: false,
      isPinned: true,
      lastUsedAt: new Date("2026-06-10T10:00:00.000Z"),
      participantId: "participant-1",
      partyId: "party-1",
      userId: "alice-local-first",
    },
  ];
  const participants: ParticipantEntity[] = [
    {
      __typename: "Participant",
      avatarId: null,
      balancesSortedBy: "name",
      id: "participant-1",
      isArchived: false,
      name: "Alice",
      partyId: "party-1",
      personalMode: false,
      phone: "+15550000000",
    },
  ];
  const mediaFiles: MediaFileEntity[] = [
    {
      __typename: "MediaFile",
      encodedBlob: "base64-encoded-image",
      id: "media-1",
      metadata: {
        mimeType: "image/jpeg",
      },
      ownerUserId: "alice-local-first",
      partyId: "party-1",
    },
  ];
  const expenseChunks: ExpenseChunkEntity[] = [
    {
      __typename: "ExpenseChunk",
      createdAt: new Date("2026-06-10T09:00:00.000Z"),
      id: "chunk-1",
      maxSize: 500,
      partyId: "party-1",
    },
  ];
  const expenseChunkBalances: ExpenseChunkBalancesEntity[] = [
    {
      __typename: "ExpenseChunkBalances",
      balances: {
        alice: {},
      },
      chunkId: "chunk-1",
      id: "chunk-balances-1",
      partyId: "party-1",
    },
  ];
  const expenses: ExpenseEntity[] = [
    {
      __typename: "Expense",
      amount: 12_50,
      chunkId: "chunk-1",
      editCopy: null,
      editCopyLastUpdatedAt: null,
      hash: "expense-hash",
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

  const repository: TrizumDataRepository & {
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
    entityTypes: new Set([
      "User",
      "Party",
      "PartyMember",
      "UserPartyState",
      "Participant",
      "MediaFile",
      "ExpenseChunk",
      "ExpenseChunkBalances",
      "Expense",
    ]),
    expenses,
    fetches: [],
    listRoots: new Set([
      "users",
      "parties",
      "partyMembers",
      "userPartyStates",
      "participants",
      "mediaFiles",
      "expenseChunks",
      "expenseChunkBalances",
      "expenses",
    ]),
    lists: [],

    async fetchEntities(type, ids, select, args) {
      repository.fetches.push({ args, ids, select: [...select], type });
      return ids.map((id) => {
        const entity = tableFor(type).find((candidate) => candidate.id === String(id));
        return entity ? projectTrizumEntity(entity, select) : null;
      });
    },

    async fetchList(root, select, args) {
      const trizumRoot = root as TrizumFateListRoot;
      repository.lists.push({ args, root: trizumRoot, select: [...select] });

      const type = typeForRoot(trizumRoot);
      const rows = tableFor(type).filter((entity) => matchesArgs(entity, args));

      return {
        items: rows.map((entity) => {
          const node = projectTrizumEntity(entity, select);

          return {
            cursor: String(node.id),
            node,
          };
        }),
        pagination: {
          hasNext: false,
          hasPrevious: false,
        },
      } satisfies TrizumDataRepositoryListResult;
    },

    async mutate(proc, input, select) {
      switch (proc) {
        case "party.create": {
          const partyInput = input as CreatePartyMutationInput;
          const party: PartyEntity = {
            __typename: "Party",
            ...partyInput,
            currency: partyInput.currency ?? "EUR",
            description: partyInput.description ?? "",
            id: nextId("party", parties.length),
            localOnlyInviteSecret: partyInput.localOnlyInviteSecret ?? null,
            symbol: partyInput.symbol ?? null,
          };
          parties.push(party);
          return projectTrizumEntity(party, select);
        }
        case "participant.create": {
          const participantInput = input as CreateParticipantMutationInput;
          const participant: ParticipantEntity = {
            __typename: "Participant",
            ...participantInput,
            avatarId: participantInput.avatarId ?? null,
            balancesSortedBy: participantInput.balancesSortedBy ?? "name",
            id: nextId("participant", participants.length),
            isArchived: participantInput.isArchived ?? false,
            personalMode: participantInput.personalMode ?? false,
            phone: participantInput.phone ?? null,
          };
          participants.push(participant);
          return projectTrizumEntity(participant, select);
        }
        case "expense.create": {
          const expenseInput = input as CreateExpenseMutationInput;
          const expense: ExpenseEntity = {
            __typename: "Expense",
            ...expenseInput,
            chunkId: expenseInput.chunkId ?? null,
            editCopy: expenseInput.editCopy ?? null,
            editCopyLastUpdatedAt: expenseInput.editCopyLastUpdatedAt ?? null,
            hash: expenseInput.hash ?? null,
            id: nextId("expense", expenses.length),
            internalMemo: expenseInput.internalMemo ?? null,
            isTransfer: expenseInput.isTransfer ?? false,
            paidBy: expenseInput.paidBy ?? {},
            photos: expenseInput.photos ?? [],
            shares: expenseInput.shares ?? {},
          };
          expenses.push(expense);
          return projectTrizumEntity(expense, select);
        }
        default:
          throw new Error(`Unsupported mutation in test: ${String(proc)}`);
      }
    },
  };

  function tableFor(type: TrizumFateTypename): TrizumFateEntity[] {
    switch (type) {
      case "User":
        return users;
      case "Party":
        return parties;
      case "PartyMember":
        return partyMembers;
      case "UserPartyState":
        return userPartyStates;
      case "Participant":
        return participants;
      case "MediaFile":
        return mediaFiles;
      case "ExpenseChunk":
        return expenseChunks;
      case "ExpenseChunkBalances":
        return expenseChunkBalances;
      case "Expense":
        return expenses;
    }
  }

  return repository;
}

function typeForRoot(root: TrizumFateListRoot): TrizumFateTypename {
  switch (root) {
    case "users":
      return "User";
    case "parties":
      return "Party";
    case "partyMembers":
      return "PartyMember";
    case "userPartyStates":
      return "UserPartyState";
    case "participants":
      return "Participant";
    case "mediaFiles":
      return "MediaFile";
    case "expenseChunks":
      return "ExpenseChunk";
    case "expenseChunkBalances":
      return "ExpenseChunkBalances";
    case "expenses":
      return "Expense";
  }
}

function matchesArgs(entity: TrizumFateEntity, args?: Record<string, unknown>) {
  for (const key of ["chunkId", "ownerUserId", "partyId", "userId"] as const) {
    if (typeof args?.[key] === "string" && key in entity) {
      return (entity as Record<string, unknown>)[key] === args[key];
    }
  }

  return true;
}

function nextId(prefix: string, count: number) {
  return `${prefix}-${count + 1}`;
}
