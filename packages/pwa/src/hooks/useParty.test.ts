import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { Repo } from "@automerge/automerge-repo";
import type { Chunk, DocumentId, StorageAdapterInterface } from "@automerge/automerge-repo/slim";
import { decodeExpenseId, type Expense } from "#src/models/expense.ts";
import type { Party, PartyExpenseChunk, PartyParticipant } from "#src/models/party.ts";
import {
  getExpenseTemplateEditorValues,
  getExpenseTemplateFromEditorValues,
  resolveExpenseTemplateValues,
  type ExpenseTemplate,
} from "#src/models/expenseTemplate.ts";
import {
  getExpenseEditorDraftValues,
  setExpenseEditorCurrencyAmount,
  getExpenseEditorCurrencyAmount,
  getExpenseEditorStoredValues,
} from "#src/lib/expenseEditorCurrency.ts";
import { FormApi } from "@tanstack/react-form";
import type { ExpenseEditorFormValues } from "#src/components/ExpenseEditor.tsx";
import { getExpenseEditValues } from "#src/routes/party_.$partyId.expense.$expenseId_.edit/-expenseEditValues.ts";
import { getReceiptSuggestions } from "#src/lib/receiptSuggestions.ts";
import type { Receipt } from "#src/lib/api/receiptContract.ts";
import { convertToUnits } from "#src/lib/expenses.ts";
import { getExpenseConversionFields } from "#src/lib/currencyConversion.ts";

const appWorkerMock = vi.hoisted(() => ({
  recalculateBalances: vi.fn<(partyId: Party["id"]) => Promise<boolean>>(),
}));

import { createPartyHelperFactory } from "./useParty.ts";

let getPartyHelpers = createPartyHelperFactory(appWorkerMock);

describe("getPartyHelpers", () => {
  beforeEach(() => {
    appWorkerMock.recalculateBalances.mockReset();
    getPartyHelpers = createPartyHelperFactory(appWorkerMock);
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

  test("updates party details without replacing participants", async () => {
    const { helpers, partyHandle } = createPartyHelpers();
    const originalParticipants = structuredClone(partyHandle.doc().participants);

    await helpers.updateDetails({
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

  test("acknowledges updated details only after storage can reopen them", async () => {
    const chunks = new Map<string, Chunk>();
    const commit = createDeferred<void>();
    let holdWrites = false;
    let saving = false;

    const storage: StorageAdapterInterface = {
      async load(key) {
        return chunks.get(JSON.stringify(key))?.data;
      },
      async save(key, data) {
        if (holdWrites && key[0] === partyHandle.documentId) {
          saving = true;
          await commit.promise;
        }

        chunks.set(JSON.stringify(key), { key, data });
      },
      async remove(key) {
        chunks.delete(JSON.stringify(key));
      },
      async loadRange(prefix) {
        return [...chunks.values()].filter(({ key }) =>
          prefix.every((segment, index) => key[index] === segment),
        );
      },
      async removeRange(prefix) {
        for (const [id, { key }] of chunks) {
          if (prefix.every((segment, index) => key[index] === segment)) chunks.delete(id);
        }
      },
    };

    const { helpers, partyHandle, repo } = createPartyHelpers(storage);
    await repo.flush([partyHandle.documentId]);
    holdWrites = true;
    let acknowledged = false;

    const save = Promise.resolve(
      helpers.updateDetails({ name: "Durable party", symbol: "🏕️", description: "Saved details" }),
    ).then(() => {
      acknowledged = true;
    });

    try {
      await expect.poll(() => saving).toBe(true);
      expect(acknowledged).toBe(false);
    } finally {
      commit.resolve();
      await save;
      await repo.shutdown();
    }

    const reopened = new Repo({ storage, network: [] });

    try {
      const persisted = await reopened.find<Party>(partyHandle.documentId);
      expect(persisted.doc()).toMatchObject({
        name: "Durable party",
        symbol: "🏕️",
        description: "Saved details",
      });
    } finally {
      await reopened.shutdown();
    }
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

  test("shares and removes receiving methods for only the selected participant", () => {
    const { helpers, partyHandle } = createPartyHelpers();
    helpers.setParticipantDetails("alice", {
      phone: "+34612345678",
      paymentMethods: {
        bizum: "+34612345678",
        paypal: "https://paypal.me/Alice123",
        other: "Wise: alice@example.com",
      },
    });
    expect(partyHandle.doc().participants.alice?.paymentMethods).toEqual({
      bizum: "+34612345678",
      paypal: "https://paypal.me/Alice123",
      other: "Wise: alice@example.com",
    });
    expect(partyHandle.doc().participants.bob?.paymentMethods).toBeUndefined();

    helpers.setParticipantDetails("alice", { phone: "", paymentMethods: {} });
    expect(partyHandle.doc().participants.alice?.paymentMethods).toEqual({});
    expect(partyHandle.doc().participants.alice?.name).toBe("Alice");
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

  test("preserves imported allocations through repeated title edits in a real document", async () => {
    const { helpers, repo } = createPartyHelpers();
    appWorkerMock.recalculateBalances.mockResolvedValue(true);

    try {
      const expense = await helpers.addExpenseToParty({
        ...createExpenseInput(),
        paidBy: { alice: 15000 },
        originalAmount: { amount: 100, currency: "USD" },
        exchangeRate: 150,
        shares: { alice: { type: "exact", value: 5000 }, bob: { type: "divide", value: 1 } },
      });

      const chunk = await repo.find<PartyExpenseChunk>(decodeExpenseId(expense.id).chunkId);

      for (const name of ["Renamed import", "Renamed again"]) {
        const saved = chunk.doc().expenses.find((entry) => entry.id === expense.id)!;
        const savedValues = { ...saved, amount: 150 };
        const form = new FormApi({ defaultValues: getExpenseEditorDraftValues(savedValues) });
        const unmount = form.mount();

        try {
          form.setFieldValue("name", name);
          const values = getExpenseEditorStoredValues(form.state.values, savedValues);
          await helpers.updateExpense({ ...saved, name: values.name, shares: values.shares });
          const updated = chunk.doc().expenses.find((entry) => entry.id === expense.id)!;
          expect(updated.name).toBe(name);
          expect(updated.shares.alice.value).toBe(5000);
          expect(updated.originalAmount).toEqual({ amount: 100, currency: "USD" });
          expect(updated.paidBy.alice).toBe(15000);
        } finally {
          unmount();
        }
      }
    } finally {
      await repo.shutdown();
    }
  });

  test.each(["legacy", "foreign", "missing-rate"] as const)(
    "persists accepted receipt totals in the selected currency for %s expenses",
    async (kind) => {
      const { helpers, repo } = createPartyHelpers();
      appWorkerMock.recalculateBalances.mockResolvedValue(true);

      try {
        const input = createExpenseInput();
        input.paidBy = { alice: kind === "legacy" ? 1000 : kind === "foreign" ? 750 : 0 };

        if (kind !== "legacy") input.originalAmount = { amount: 1000, currency: "USD" };

        if (kind === "foreign") input.exchangeRate = 0.75;

        const expense = await helpers.addExpenseToParty(input);
        const chunk = await repo.find<PartyExpenseChunk>(decodeExpenseId(expense.id).chunkId);

        const receipt: Receipt = {
          titleSuggestions: ["Coffee"],
          merchantName: "Cafe",
          total: "15.70",
          currency: kind === "legacy" ? "EUR" : "USD",
          items: [],
        };

        for (const total of ["15.70", "20.00"]) {
          const saved = chunk.doc().expenses.find((entry) => entry.id === expense.id)!;
          const defaults: ExpenseEditorFormValues = getExpenseEditValues(saved);
          const form = new FormApi({ defaultValues: getExpenseEditorDraftValues(defaults) });
          const unmount = form.mount();

          try {
            const baseline = {
              name: form.state.values.name,
              amount: getExpenseEditorCurrencyAmount(form.state.values),
            };

            const suggestions = getReceiptSuggestions({
              receipt: { ...receipt, total },
              currency: form.state.values.originalAmount?.currency ?? "EUR",
              current: baseline,
              baseline,
            });

            expect(suggestions.amount).toBe(Number(total));
            setExpenseEditorCurrencyAmount(form, suggestions.amount!);
            const values = getExpenseEditorStoredValues(form.state.values, defaults);
            await helpers.updateExpense({
              ...saved,
              paidBy: { [values.paidBy]: convertToUnits(values.amount) },
              shares: values.shares,
              ...getExpenseConversionFields(values),
            });
            const updated = chunk.doc().expenses.find((entry) => entry.id === expense.id)!;
            const expectedUnits = total === "15.70" ? 1570 : 2000;

            expect(updated.paidBy.alice).toBe(
              kind === "legacy"
                ? expectedUnits
                : kind === "foreign"
                  ? total === "15.70"
                    ? 1178
                    : 1500
                  : 0,
            );
            expect(updated.originalAmount).toEqual(
              kind === "legacy" ? undefined : { amount: expectedUnits, currency: "USD" },
            );
            expect(updated.exchangeRate).toBe(kind === "foreign" ? 0.75 : undefined);
            expect(updated.name).toBe(saved.name);
            expect(updated.paidAt).toEqual(saved.paidAt);
            expect(updated.photos).toEqual(saved.photos);
            expect(updated.shares.alice.type).toBe("divide");
            expect(updated.shares.bob.type).toBe("divide");
            expect(updated.shares.alice.value).toBe(1);
            expect(updated.shares.bob.value).toBe(1);
          } finally {
            unmount();
          }
        }
      } finally {
        await repo.shutdown();
      }
    },
  );

  test.each(["legacy", "currency-only", "fixed"] as const)(
    "round-trips %s currency defaults through a real template form and document",
    async (kind) => {
      const { helpers, partyHandle, repo } = createPartyHelpers();
      const unmountForms: Array<() => void> = [];
      appWorkerMock.recalculateBalances.mockResolvedValue(true);

      try {
        const template = createExpenseTemplate("currency-defaults");
        template.amount = 10000;
        template.expenseName = "Abroad";
        template.shares = {
          alice: { type: "exact", value: 2500 },
          bob: { type: "divide", value: 1 },
        };

        if (kind !== "legacy") {
          template.currency = "USD";
          template.exchangeRateMode = kind === "fixed" ? "fixed" : "latest";
        }

        if (kind === "fixed") template.exchangeRate = 0.8;

        if (kind === "currency-only") {
          delete template.amount;
          template.shares = {};
          template.participantSelection = "specific";
        }

        helpers.saveExpenseTemplate(template);

        const form = new FormApi({
          defaultValues: getExpenseTemplateEditorValues(
            partyHandle.doc().expenseTemplates?.[template.id],
          ),
        });

        unmountForms.push(form.mount());
        form.setFieldValue("name", "Renamed currency defaults");
        helpers.saveExpenseTemplate(
          getExpenseTemplateFromEditorValues(template.id, form.state.values),
        );
        const saved = partyHandle.doc().expenseTemplates?.[template.id];
        expect(saved).toMatchObject({ name: "Renamed currency defaults", shares: template.shares });
        expect(saved?.currency).toBe(template.currency);
        expect(saved?.exchangeRateMode).toBe(template.exchangeRateMode);
        expect(saved?.exchangeRate).toBe(template.exchangeRate);

        let persisted: Expense | undefined;

        if (kind !== "currency-only") {
          const values = resolveExpenseTemplateValues({
            currentParticipantId: "alice",
            now: new Date(),
            party: partyHandle.doc(),
            templateId: template.id,
          });

          const expense = await helpers.addExpenseToParty({
            name: values.name,
            paidAt: values.paidAt,
            paidBy: { [values.paidBy]: convertToUnits(values.amount) },
            shares: values.shares,
            photos: [],
            ...getExpenseConversionFields(values),
          });

          const chunk = (
            await repo.find<PartyExpenseChunk>(decodeExpenseId(expense.id).chunkId)
          ).doc();

          persisted = chunk.expenses.find((entry) => entry.id === expense.id);
        }

        expect(persisted?.paidBy.alice).toBe(
          kind === "fixed" ? 8000 : kind === "legacy" ? 10000 : undefined,
        );
        expect(persisted?.originalAmount?.amount).toBe(kind === "fixed" ? 10000 : undefined);
        expect(persisted?.shares.alice.value).toBe(
          kind === "fixed" ? 2000 : kind === "legacy" ? 2500 : undefined,
        );

        const reopened = new FormApi({
          defaultValues: getExpenseTemplateEditorValues(
            partyHandle.doc().expenseTemplates?.[template.id],
          ),
        });

        unmountForms.push(reopened.mount());
        reopened.setFieldValue("exchangeRateMode", "latest");
        reopened.setFieldValue("exchangeRate", null);
        helpers.saveExpenseTemplate(
          getExpenseTemplateFromEditorValues(template.id, reopened.state.values),
        );
        expect(partyHandle.doc().expenseTemplates?.[template.id]?.exchangeRate).toBeUndefined();
        reopened.setFieldValue("currency", null);
        helpers.saveExpenseTemplate(
          getExpenseTemplateFromEditorValues(template.id, reopened.state.values),
        );
        expect(partyHandle.doc().expenseTemplates?.[template.id]?.currency).toBeUndefined();
        expect(partyHandle.doc().expenseTemplates?.[template.id]?.exchangeRateMode).toBeUndefined();
      } finally {
        for (const unmount of unmountForms) unmount();
        await repo.shutdown();
      }
    },
  );
});

function createPartyHelpers(storage?: StorageAdapterInterface) {
  const repo = new Repo({
    network: [],
    storage,
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
  // SAFETY: Synthetic document IDs only key the in-memory fixture; this test never decodes them or opens a network document.
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
