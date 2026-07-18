import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { Repo } from "@automerge/automerge-repo";
import type { DocumentId } from "@automerge/automerge-repo/slim";
import type { Expense } from "#src/models/expense.ts";
import type { Party, PartyParticipant } from "#src/models/party.ts";
import {
  getExpenseTemplateEditorValues,
  type ExpenseTemplate,
} from "#src/models/expenseTemplate.ts";

const appWorkerMock = vi.hoisted(() => ({
  recalculateBalances: vi.fn<(partyId: Party["id"]) => Promise<boolean>>(),
}));

vi.mock("#src/lib/appWorker/client.ts", () => ({
  appWorker: appWorkerMock,
}));

const { getPartyHelpers } = await import("./useParty.ts");

describe("getPartyHelpers", () => {
  beforeEach(() => {
    appWorkerMock.recalculateBalances.mockReset();
  });

  test("schedules balance recalculation after expense mutations", async () => {
    const firstRecalculation = createDeferred<boolean>();
    const { helpers, partyHandle } = createPartyHelpers();

    appWorkerMock.recalculateBalances
      .mockReturnValueOnce(firstRecalculation.promise)
      .mockResolvedValue(true);

    const expense = await helpers.addExpenseToParty(createExpenseInput());

    expect(appWorkerMock.recalculateBalances).toHaveBeenCalledOnce();
    expect(appWorkerMock.recalculateBalances).toHaveBeenCalledWith(partyHandle.documentId);

    await helpers.updateExpense({
      ...expense,
      name: "Updated lunch",
    });
    await helpers.removeExpense(expense.id);

    expect(appWorkerMock.recalculateBalances).toHaveBeenCalledOnce();

    firstRecalculation.resolve(true);
    await flushPromises();

    expect(appWorkerMock.recalculateBalances).toHaveBeenCalledTimes(2);
    expect(appWorkerMock.recalculateBalances).toHaveBeenLastCalledWith(partyHandle.documentId);
  });

  test("shares scheduled balance recalculation state between helper instances", async () => {
    const firstRecalculation = createDeferred<boolean>();
    const { helpers, partyHandle, repo } = createPartyHelpers();
    const secondHelpers = getPartyHelpers(repo, partyHandle);

    appWorkerMock.recalculateBalances
      .mockReturnValueOnce(firstRecalculation.promise)
      .mockResolvedValue(true);

    const expense = await helpers.addExpenseToParty(createExpenseInput());

    expect(appWorkerMock.recalculateBalances).toHaveBeenCalledOnce();
    expect(appWorkerMock.recalculateBalances).toHaveBeenCalledWith(partyHandle.documentId);

    await secondHelpers.updateExpense({
      ...expense,
      name: "Updated from another helper",
    });

    expect(appWorkerMock.recalculateBalances).toHaveBeenCalledOnce();

    firstRecalculation.resolve(true);
    await flushPromises();

    expect(appWorkerMock.recalculateBalances).toHaveBeenCalledTimes(2);
    expect(appWorkerMock.recalculateBalances).toHaveBeenLastCalledWith(partyHandle.documentId);
  });

  test("updates party details without replacing participants", () => {
    const { helpers, partyHandle } = createPartyHelpers();
    const originalParticipants = structuredClone(partyHandle.doc().participants);

    helpers.updateDetails({
      name: "Updated party",
      symbol: "🏕️",
      description: "Updated description",
    });

    expect(partyHandle.doc()).toMatchObject({
      name: "Updated party",
      symbol: "🏕️",
      description: "Updated description",
      participants: originalParticipants,
    });
  });

  test("updates participants without replacing party details", () => {
    const { helpers, partyHandle } = createPartyHelpers();
    const originalDetails = {
      name: partyHandle.doc().name,
      symbol: partyHandle.doc().symbol,
      description: partyHandle.doc().description,
    };
    const participants = {
      charlie: createParticipant("charlie", "Charlie"),
    };

    helpers.updateParticipants(participants);

    expect(partyHandle.doc()).toMatchObject({
      ...originalDetails,
      participants,
    });
  });

  test("stores the default-template shortcut as a per-participant preference", () => {
    const { helpers, partyHandle } = createPartyHelpers();

    helpers.setParticipantDetails("alice", {
      alwaysUseDefaultExpenseTemplate: true,
    });

    expect(partyHandle.doc().participants.alice?.alwaysUseDefaultExpenseTemplate).toBe(true);
    expect(partyHandle.doc().participants.bob?.alwaysUseDefaultExpenseTemplate).toBeUndefined();
  });

  test("clears the default when deleting its expense template", () => {
    const { helpers, partyHandle } = createPartyHelpers();
    const template = createExpenseTemplate("groceries");

    helpers.saveExpenseTemplate(template);
    helpers.setDefaultExpenseTemplate(template.id);
    helpers.deleteExpenseTemplate(template.id);

    expect(partyHandle.doc().expenseTemplates).toEqual({});
    expect(partyHandle.doc().defaultExpenseTemplateId).toBeUndefined();
  });

  test("selects a custom default when blank templates are disabled", () => {
    const { helpers, partyHandle } = createPartyHelpers();
    const groceries = createExpenseTemplate("groceries");
    const dinner = createExpenseTemplate("dinner");

    helpers.saveExpenseTemplate(groceries);
    helpers.saveExpenseTemplate(dinner);
    helpers.setOnlyUseCustomExpenseTemplates(true, groceries.id);

    expect(partyHandle.doc().onlyUseCustomExpenseTemplates).toBe(true);
    expect(partyHandle.doc().defaultExpenseTemplateId).toBe(groceries.id);
  });

  test("selects the first remaining default when deleting the custom-only default", () => {
    const { helpers, partyHandle } = createPartyHelpers();
    const groceries = createExpenseTemplate("groceries");
    const dinner = createExpenseTemplate("dinner");

    helpers.saveExpenseTemplate(groceries);
    helpers.saveExpenseTemplate(dinner);
    helpers.setDefaultExpenseTemplate(groceries.id);
    helpers.setOnlyUseCustomExpenseTemplates(true, dinner.id);
    helpers.deleteExpenseTemplate(groceries.id);

    expect(partyHandle.doc().onlyUseCustomExpenseTemplates).toBe(true);
    expect(partyHandle.doc().defaultExpenseTemplateId).toBe(dinner.id);
  });

  test("restores blank expenses after deleting the final custom template", () => {
    const { helpers, partyHandle } = createPartyHelpers();
    const groceries = createExpenseTemplate("groceries");

    helpers.saveExpenseTemplate(groceries);
    helpers.setOnlyUseCustomExpenseTemplates(true, groceries.id);
    helpers.deleteExpenseTemplate(groceries.id);

    expect(partyHandle.doc().onlyUseCustomExpenseTemplates).toBeUndefined();
    expect(partyHandle.doc().defaultExpenseTemplateId).toBeUndefined();
  });

  test("keeps blank expenses enabled when no custom template is available", () => {
    const { helpers, partyHandle } = createPartyHelpers();

    helpers.setOnlyUseCustomExpenseTemplates(true);

    expect(partyHandle.doc().onlyUseCustomExpenseTemplates).toBeUndefined();
    expect(partyHandle.doc().defaultExpenseTemplateId).toBeUndefined();
  });

  test("limits each party to four expense templates", () => {
    const { helpers, partyHandle } = createPartyHelpers();

    for (const id of ["one", "two", "three", "four"]) {
      helpers.saveExpenseTemplate(createExpenseTemplate(id));
    }

    expect(() => helpers.saveExpenseTemplate(createExpenseTemplate("five"))).toThrow(
      "Expense template limit reached",
    );
    expect(Object.keys(partyHandle.doc().expenseTemplates ?? {})).toHaveLength(4);
  });

  test("saves edits built from an existing document template", () => {
    const { helpers, partyHandle } = createPartyHelpers();
    const template = createExpenseTemplate("groceries");
    template.shares = {
      alice: { type: "divide", value: 1 },
      bob: { type: "divide", value: 2 },
    };
    helpers.saveExpenseTemplate(template);

    const storedTemplate = partyHandle.doc().expenseTemplates?.[template.id];
    expect(storedTemplate).toBeDefined();
    const editorValues = getExpenseTemplateEditorValues(storedTemplate, ["alice", "bob"]);

    expect(() =>
      helpers.saveExpenseTemplate({
        id: template.id,
        name: "Updated groceries",
        symbol: editorValues.symbol,
        paidBy: { type: "current-participant" },
        participantSelection: editorValues.participantSelection,
        shares: editorValues.shares,
      }),
    ).not.toThrow();
    expect(partyHandle.doc().expenseTemplates?.[template.id]?.name).toBe("Updated groceries");
  });
});

function createPartyHelpers() {
  const repo = new Repo({
    network: [],
  });
  const partyHandle = repo.create<Party>(createParty());

  partyHandle.change((party) => {
    party.id = partyHandle.documentId;
  });

  return {
    helpers: getPartyHelpers(repo, partyHandle),
    partyHandle,
    repo,
  };
}

function createParty(): Party {
  return {
    id: "" as DocumentId,
    type: "party",
    name: "Test party",
    symbol: "🧪",
    description: "",
    currency: "EUR",
    participants: {
      alice: createParticipant("alice", "Alice"),
      bob: createParticipant("bob", "Bob"),
    },
    chunkRefs: [],
  };
}

function createParticipant(id: PartyParticipant["id"], name: PartyParticipant["name"]) {
  return {
    id,
    name,
  };
}

function createExpenseInput(): Omit<Expense, "id" | "__hash"> {
  return {
    name: "Lunch",
    paidAt: new Date("2024-01-01T12:00:00.000Z"),
    paidBy: {
      alice: 1000,
    },
    shares: {
      alice: {
        type: "divide",
        value: 1,
      },
      bob: {
        type: "divide",
        value: 1,
      },
    },
    photos: [],
  };
}

function createExpenseTemplate(id: string): ExpenseTemplate {
  return {
    id,
    name: id,
    symbol: "🧾",
    paidBy: { type: "current-participant" },
    participantSelection: "specific",
    shares: {},
  };
}

function createDeferred<T>() {
  let resolve: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return {
    promise,
    resolve: resolve!,
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
