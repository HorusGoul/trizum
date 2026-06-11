import { describe, expect, test } from "vite-plus/test";
import { createPolicyTestApp } from "jazz-tools/testing";
import {
  createTrizumFateClient,
  ExpenseListItemView,
  JoinedPartyView,
  MediaFileMetadataView,
  PartySummaryView,
  projectTrizumEntity,
  trizumEntityDefinitions,
  trizumJazzApp,
  trizumJazzPermissions,
  trizumJazzWasmSchema,
  trizumListDefinitions,
  UserSettingsView,
  type CreateExpenseMutationInput,
  type CreateJoinedPartyMutationInput,
  type CreateParticipantMutationInput,
  type CreatePartyMutationInput,
  type ExpenseEntity,
  type JoinedPartyEntity,
  type MediaFileEntity,
  type PartyMemberEntity,
  type ParticipantEntity,
  type PartyEntity,
  type TrizumDataRepository,
  type TrizumDataRepositoryListResult,
  type TrizumFateEntity,
  type TrizumFateListRoot,
  type TrizumFateTypename,
  type UpsertJoinedPartyMutationInput,
  type UpsertUserMutationInput,
  type UserEntity,
} from "./index.js";

describe("Jazz alpha schema", () => {
  test("compiles privacy-aware row policies into the Jazz wasm schema", () => {
    expect(trizumJazzWasmSchema.users?.policies?.select?.using).toStrictEqual({
      column: "$createdBy",
      op: "Eq",
      type: "Cmp",
      value: {
        path: ["user_id"],
        type: "SessionRef",
      },
    });
    expect(trizumJazzWasmSchema.parties?.policies?.select?.using).toMatchObject({
      type: "Or",
    });
    expect(trizumJazzWasmSchema.mediaFiles?.policies?.select?.using).toMatchObject({
      type: "Or",
    });
    expect(trizumJazzWasmSchema.joinedParties?.policies?.select?.using).toStrictEqual({
      column: "$createdBy",
      op: "Eq",
      type: "Cmp",
      value: {
        path: ["user_id"],
        type: "SessionRef",
      },
    });
    expectPartyAccessPolicy(trizumJazzWasmSchema.expenses?.policies?.select?.using);
    expect(trizumJazzWasmSchema.parties?.policies?.update?.using).toMatchObject({
      exprs: expect.arrayContaining([
        {
          column: "ownerUserId",
          op: "Eq",
          type: "Cmp",
          value: {
            path: ["user_id"],
            type: "SessionRef",
          },
        },
        {
          exprs: expect.arrayContaining([
            {
              condition: {
                exprs: expect.arrayContaining([
                  {
                    column: "role",
                    op: "Eq",
                    type: "Cmp",
                    value: {
                      type: "Literal",
                      value: "owner",
                    },
                  },
                ]),
                type: "And",
              },
              table: "partyMembers",
              type: "Exists",
            },
            {
              condition: {
                exprs: expect.arrayContaining([
                  {
                    column: "role",
                    op: "Eq",
                    type: "Cmp",
                    value: {
                      type: "Literal",
                      value: "editor",
                    },
                  },
                ]),
                type: "And",
              },
              table: "partyMembers",
              type: "Exists",
            },
          ]),
          type: "Or",
        },
      ]),
      type: "Or",
    });
    expectInheritedPartyUpdatePolicy(
      trizumJazzWasmSchema.participants?.policies?.insert?.with_check,
    );
    expectInheritedPartyUpdatePolicy(trizumJazzWasmSchema.participants?.policies?.update?.using);
    expectInheritedPartyUpdatePolicy(
      trizumJazzWasmSchema.participants?.policies?.update?.with_check,
    );
    expectInheritedPartyUpdatePolicy(trizumJazzWasmSchema.participants?.policies?.delete?.using);
    expectInheritedPartyUpdatePolicy(trizumJazzWasmSchema.expenses?.policies?.insert?.with_check);
    expectInheritedPartyUpdatePolicy(trizumJazzWasmSchema.expenses?.policies?.update?.using);
    expectInheritedPartyUpdatePolicy(trizumJazzWasmSchema.expenses?.policies?.update?.with_check);
    expectInheritedPartyUpdatePolicy(trizumJazzWasmSchema.expenses?.policies?.delete?.using);
  });

  test("allows a local-first user to join an invited party and write party-scoped data", async () => {
    const testApp = await createPolicyTestApp(trizumJazzApp, trizumJazzPermissions, expect);

    try {
      const partyId = "11111111-1111-5111-8111-111111111111";
      const participantId = "22222222-2222-5222-8222-222222222222";
      const bobMemberId = "33333333-3333-5333-8333-333333333333";
      const expenseId = "44444444-4444-5444-8444-444444444444";
      const bobSession = {
        authMode: "local-first" as const,
        claims: {},
        user_id: "bob-local-first",
      };
      const bob = testApp.as(bobSession);
      const charlie = testApp.as({
        authMode: "local-first" as const,
        claims: {},
        user_id: "charlie-local-first",
      });

      testApp.seed((db) => {
        db.insert(
          trizumJazzApp.parties,
          {
            currency: "EUR",
            description: "Shared trip",
            localOnlyInviteSecret: "invite-secret",
            name: "Madrid",
            ownerUserId: "alice-local-first",
            symbol: "MAD",
          },
          { id: partyId },
        );
        db.insert(
          trizumJazzApp.participants,
          {
            balancesSortedBy: "name",
            isArchived: false,
            localId: "bob",
            name: "Bob",
            partyId,
            personalMode: false,
          },
          { id: participantId },
        );
      });

      await expect(bob.all(trizumJazzApp.participants.where({ partyId }))).resolves.toHaveLength(1);
      bob.expectDenied((db) =>
        db.insert(
          trizumJazzApp.expenses,
          {
            amount: 1_200,
            isTransfer: false,
            name: "Coffee",
            paidAt: new Date("2026-06-11T13:00:00.000Z"),
            paidBy: { bob: 1_200 },
            partyId,
            photos: [],
            shares: { bob: { type: "divide", value: 1 } },
          },
          { id: "55555555-5555-5555-8555-555555555555" },
        ),
      );

      await bob
        .insert(
          trizumJazzApp.partyMembers,
          {
            participantId: "bob",
            partyId,
            role: "editor",
            userId: bobSession.user_id,
          },
          { id: bobMemberId },
        )
        .wait({ tier: "edge" });

      await expect(
        bob.all(trizumJazzApp.partyMembers.where({ partyId, userId: bobSession.user_id })),
      ).resolves.toHaveLength(1);
      await bob
        .insert(
          trizumJazzApp.expenses,
          {
            amount: 2_400,
            isTransfer: false,
            name: "Lunch",
            paidAt: new Date("2026-06-11T12:00:00.000Z"),
            paidBy: { bob: 2_400 },
            partyId,
            photos: [],
            shares: { bob: { type: "divide", value: 1 } },
          },
          { id: expenseId },
        )
        .wait({ tier: "edge" });
      await bob
        .update(trizumJazzApp.expenses, expenseId, {
          name: "Updated lunch",
        })
        .wait({ tier: "edge" });
      await bob
        .update(trizumJazzApp.participants, participantId, {
          phone: "+15550000000",
        })
        .wait({ tier: "edge" });
      charlie.expectDenied((db) =>
        db.insert(
          trizumJazzApp.expenses,
          {
            amount: 1_200,
            isTransfer: false,
            name: "Coffee",
            paidAt: new Date("2026-06-11T13:00:00.000Z"),
            paidBy: { charlie: 1_200 },
            partyId,
            photos: [],
            shares: { charlie: { type: "divide", value: 1 } },
          },
          { id: "66666666-6666-5666-8666-666666666666" },
        ),
      );
    } finally {
      await testApp.shutdown();
    }
  });
});

function expectPartyAccessPolicy(policyExpression: unknown) {
  expect(policyExpression).toMatchObject({ type: "Or" });
  expect((policyExpression as { exprs?: unknown[] } | undefined)?.exprs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ table: "parties", type: "Exists" }),
      expect.objectContaining({ table: "partyMembers", type: "Exists" }),
    ]),
  );
}

function expectInheritedPartyUpdatePolicy(policyExpression: unknown) {
  expect(policyExpression).toStrictEqual({
    operation: "Update",
    type: "Inherits",
    via_column: "partyId",
  });
}

describe("Trizum Jazz model surface", () => {
  test("extracts the PWA data boundaries into entity definitions", () => {
    expect(trizumEntityDefinitions.map((definition) => definition.type)).toStrictEqual([
      "User",
      "Party",
      "PartyMember",
      "JoinedParty",
      "Participant",
      "MediaFile",
      "Expense",
    ]);
    expect(trizumListDefinitions.map((definition) => definition.root)).toStrictEqual([
      "users",
      "parties",
      "partyMembers",
      "joinedParties",
      "participants",
      "mediaFiles",
      "expenses",
    ]);
    expect(
      trizumListDefinitions.find((definition) => definition.root === "expenses"),
    ).toMatchObject({
      pagination: "offset",
    });
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

  test("stores the joined parties a user sees in their party list", async () => {
    const repository = createMemoryRepository();
    const client = createTrizumFateClient({ repository });

    const { joinedParties } = await client.request({
      joinedParties: {
        args: { userId: "alice-local-first" },
        list: JoinedPartyView,
      },
    });
    const [joinedPartyRef] = joinedParties;
    expect(joinedPartyRef).toBeDefined();

    const snapshot = await client.readView(JoinedPartyView, joinedPartyRef!);

    expect(snapshot.data).toMatchObject({
      __typename: "JoinedParty",
      id: "joined-party-1",
      isArchived: false,
      isPinned: true,
      participantId: "participant-1",
      partyId: "party-1",
      userId: "alice-local-first",
    });
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

  test("upserts user settings and joined party state through Fate", async () => {
    const repository = createMemoryRepository();
    const client = createTrizumFateClient({ repository });

    const user = await client.mutations.user.upsert({
      input: {
        authMode: "localFirst",
        displayName: "Updated Alice",
        hue: 190,
        id: "alice-local-first",
        openLastPartyOnLaunch: true,
      },
      view: UserSettingsView,
    });
    const joinedParty = await client.mutations.joinedParty.upsert({
      input: {
        id: "joined-party-1",
        isArchived: true,
        isPinned: false,
        lastUsedAt: new Date("2026-06-10T12:00:00.000Z"),
        participantId: "participant-1",
        partyId: "party-1",
        userId: "alice-local-first",
      },
      view: JoinedPartyView,
    });

    if (user.error) {
      throw user.error;
    }

    if (joinedParty.error) {
      throw joinedParty.error;
    }

    expect(user.result).toMatchObject({
      __typename: "User",
      displayName: "Updated Alice",
      hue: 190,
      id: "alice-local-first",
      openLastPartyOnLaunch: true,
    });
    expect(joinedParty.result).toMatchObject({
      __typename: "JoinedParty",
      id: "joined-party-1",
      isArchived: true,
      isPinned: false,
      partyId: "party-1",
      userId: "alice-local-first",
    });
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
  const joinedParties: JoinedPartyEntity[] = [
    {
      __typename: "JoinedParty",
      id: "joined-party-1",
      isArchived: false,
      isPinned: true,
      joinedAt: new Date("2026-06-10T09:30:00.000Z"),
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
      id: "participant-row-1",
      isArchived: false,
      localId: "participant-1",
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
  const expenses: ExpenseEntity[] = [
    {
      __typename: "Expense",
      amount: 12_50,
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
      "JoinedParty",
      "Participant",
      "MediaFile",
      "Expense",
    ]),
    expenses,
    fetches: [],
    listRoots: new Set([
      "users",
      "parties",
      "partyMembers",
      "joinedParties",
      "participants",
      "mediaFiles",
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
        case "user.upsert": {
          const userInput = input as UpsertUserMutationInput;
          const user = upsertEntity(users, userInput.id, {
            __typename: "User",
            accountProvider: null,
            authMode: userInput.authMode ?? "localFirst",
            autoOpenCalculator: userInput.autoOpenCalculator ?? false,
            avatarId: userInput.avatarId ?? null,
            displayName: userInput.displayName ?? null,
            fullAccountUserId: null,
            hue: userInput.hue ?? null,
            id: userInput.id,
            lastOpenedPartyId: userInput.lastOpenedPartyId ?? null,
            locale: userInput.locale ?? null,
            openLastPartyOnLaunch: userInput.openLastPartyOnLaunch ?? false,
            phone: userInput.phone ?? null,
          });
          return projectTrizumEntity(user, select);
        }
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
            localId: participantInput.localId,
            personalMode: participantInput.personalMode ?? false,
            phone: participantInput.phone ?? null,
          };
          participants.push(participant);
          return projectTrizumEntity(participant, select);
        }
        case "joinedParty.create": {
          const joinedPartyInput = input as CreateJoinedPartyMutationInput;
          const joinedParty: JoinedPartyEntity = {
            __typename: "JoinedParty",
            ...joinedPartyInput,
            id: nextId("joined-party", joinedParties.length),
            isArchived: joinedPartyInput.isArchived ?? false,
            isPinned: joinedPartyInput.isPinned ?? false,
            joinedAt: joinedPartyInput.joinedAt ?? null,
            lastUsedAt: joinedPartyInput.lastUsedAt ?? null,
            participantId: joinedPartyInput.participantId ?? null,
          };
          joinedParties.push(joinedParty);
          return projectTrizumEntity(joinedParty, select);
        }
        case "joinedParty.upsert": {
          const joinedPartyInput = input as UpsertJoinedPartyMutationInput;
          const joinedParty = upsertEntity(joinedParties, joinedPartyInput.id, {
            __typename: "JoinedParty",
            ...joinedPartyInput,
            isArchived: joinedPartyInput.isArchived ?? false,
            isPinned: joinedPartyInput.isPinned ?? false,
            joinedAt: joinedPartyInput.joinedAt ?? null,
            lastUsedAt: joinedPartyInput.lastUsedAt ?? null,
            participantId: joinedPartyInput.participantId ?? null,
          });
          return projectTrizumEntity(joinedParty, select);
        }
        case "expense.create": {
          const expenseInput = input as CreateExpenseMutationInput;
          const expense: ExpenseEntity = {
            __typename: "Expense",
            ...expenseInput,
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
      case "JoinedParty":
        return joinedParties;
      case "Participant":
        return participants;
      case "MediaFile":
        return mediaFiles;
      case "Expense":
        return expenses;
    }
  }

  return repository;
}

function upsertEntity<TEntity extends TrizumFateEntity>(
  entities: TEntity[],
  id: string,
  nextEntity: TEntity,
) {
  const index = entities.findIndex((entity) => entity.id === id);

  if (index === -1) {
    entities.push(nextEntity);
    return nextEntity;
  }

  entities[index] = {
    ...entities[index],
    ...nextEntity,
  };

  return entities[index]!;
}

function typeForRoot(root: TrizumFateListRoot): TrizumFateTypename {
  switch (root) {
    case "users":
      return "User";
    case "parties":
      return "Party";
    case "partyMembers":
      return "PartyMember";
    case "joinedParties":
      return "JoinedParty";
    case "participants":
      return "Participant";
    case "mediaFiles":
      return "MediaFile";
    case "expenses":
      return "Expense";
  }
}

function matchesArgs(entity: TrizumFateEntity, args?: Record<string, unknown>) {
  for (const key of ["ownerUserId", "partyId", "userId"] as const) {
    if (typeof args?.[key] === "string" && key in entity) {
      return (entity as Record<string, unknown>)[key] === args[key];
    }
  }

  return true;
}

function nextId(prefix: string, count: number) {
  return `${prefix}-${count + 1}`;
}
