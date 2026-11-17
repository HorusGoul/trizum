import { deleteAt } from "@automerge/automerge-repo";
import { clone } from "@opentf/std";
import { toDecimal } from "dinero.js";
import { createMoney, isCurrencyCode, type CurrencyCode } from "../../src/lib/money";
import type { ExchangeRates } from "../../src/lib/api/exchangeRatesContract";
import {
  getBundledExchangeRates,
  getExchangeRate,
  mergeExchangeRates,
} from "../../src/lib/exchangeRateTables";
import { convertExpenseAmount } from "../../src/lib/currencyConversion";
import { convertToUnits } from "../../src/lib/expenses";
import { addExpenseSchema } from "@trizum/mcp/contracts";
import { recalculateChunkBalances } from "./recalculateChunkBalances";
import {
  McpToolError,
  type AddExpenseInput,
  type GetExpenseInput,
  type ExpenseView,
  type UpdateExpenseInput,
  type DeleteExpenseInput,
} from "@trizum/mcp/index";
import type { AutomergeDocuments } from "../automergeDocuments";
import {
  applyExpenseDiff,
  calculateBalancesByParticipant,
  calculateExpenseHash,
  createExpenseId,
  decodeExpenseId,
  getExpenseTotalAmount,
  getExpenseUnitShares,
  findExpenseById,
  type Expense,
} from "../../src/models/expense";
import type {
  Party,
  PartyExpenseChunk,
  PartyExpenseChunkBalances,
  PartyExpenseChunkRef,
} from "../../src/models/party";
import type { DocumentId } from "@automerge/automerge-repo";

export type PartyDocuments = Pick<
  AutomergeDocuments,
  "read" | "create" | "change" | "fork" | "find"
>;

export const MAX_CHUNKS = 100;

export type LoadExpenseRates = (base: CurrencyCode) => Promise<ExchangeRates>;

/** Expense edits own scope checks, optimistic versions, and shared-balance reconciliation. */
export class PartyExpenses {
  constructor(
    private readonly documents: PartyDocuments,
    private readonly loadRates?: LoadExpenseRates,
  ) {}
  async add(party: Party, input: AddExpenseInput) {
    const originalAmount = parseExpenseAmount(input.amount);
    const people = [input.paidBy, ...input.splitBetween];

    if (
      people.some(
        (id) => !Object.hasOwn(party.participants, id) || party.participants[id].isArchived,
      )
    ) {
      throw new McpToolError(
        "Choose active participant IDs from get_party for the payer and everyone sharing this expense.",
      );
    }

    if (new Set(input.splitBetween).size !== input.splitBetween.length)
      throw new McpToolError("A participant can appear only once in the split.");

    if (party.chunkRefs.length >= MAX_CHUNKS)
      throw new McpToolError(
        "This party is too large for this integration. Open it in trizum to add the expense.",
      );

    const currency = input.currency ?? party.currency;

    if (!isCurrencyCode(currency))
      throw new McpToolError(
        "Unsupported expense currency. Choose a currency supported by trizum.",
      );

    const converted = currency !== party.currency;

    if (!converted && input.exchangeRate !== undefined)
      throw new McpToolError(
        "An exchange rate requires an expense currency different from the party currency.",
      );

    const rate = converted
      ? await this.exchangeRate(party.currency, currency, input.exchangeRate)
      : 1;

    const amount = converted ? convertExpenseAmount(originalAmount, rate) : originalAmount;

    if (amount === undefined || amount <= 0)
      throw new McpToolError(
        "The converted amount must be positive and within trizum's supported range. Check the amount and exchange rate.",
      );

    // Independent requests must not replace the same derived balance map.
    // Publish a completed chunk and its balance before merging its party reference.
    // maxSize: 1 also makes normal PWA appends start a new chunk.
    const chunk = await this.documents.create<PartyExpenseChunk>((id) => {
      const expense: Expense = {
        id: createExpenseId(id),
        name: input.name,
        paidAt: new Date(input.paidAt),
        paidBy: { [input.paidBy]: amount },
        // Match Automerge's map order for saved hashes and odd-cent allocations.
        shares: Object.fromEntries(
          input.splitBetween.toSorted().map((id) => [id, { type: "divide", value: 1 }]),
        ),
        photos: [],
        __hash: "",
      };

      if (converted) {
        expense.originalAmount = { amount: originalAmount, currency };
        expense.exchangeRate = rate;

        const originalShares = getExpenseUnitShares({
          paidBy: { [input.paidBy]: originalAmount },
          shares: expense.shares,
        });

        for (const [id, share] of Object.entries(expense.shares))
          share.originalAmount = originalShares[id];
      }

      expense.__hash = calculateExpenseHash(expense);

      return {
        id,
        type: "expenseChunk",
        partyId: party.id,
        createdAt: new Date(),
        maxSize: 1,
        expenses: [expense],
      };
    });

    const balances = await this.documents.create<PartyExpenseChunkBalances>((id) => ({
      id,
      type: "expenseChunkBalances",
      partyId: party.id,
      balances: calculateBalancesByParticipant(chunk.expenses, party.participants),
    }));

    const reference = { chunkId: chunk.id, balancesId: balances.id, createdAt: chunk.createdAt };
    await this.documents.change<Party>(party.id, (doc) => {
      doc.chunkRefs.unshift(reference);
    });
  }

  private async exchangeRate(base: CurrencyCode, currency: CurrencyCode, supplied?: number) {
    if (supplied !== undefined) {
      if (!Number.isFinite(supplied) || supplied <= 0)
        throw new McpToolError("Choose a positive finite exchange rate supplied by the user.");

      return supplied;
    }

    try {
      if (this.loadRates) {
        const table = await this.loadRates(base);

        const quote =
          table.base === base
            ? getExchangeRate(mergeExchangeRates(getBundledExchangeRates(base), table), currency)
            : undefined;

        if (quote) return quote.rate;
      }
    } catch {
      // A missing reference rate must not result in a guessed conversion or a partial write.
    }

    throw new McpToolError(
      "No reference exchange rate is available for this currency. Ask the user for a rate in party-currency units per expense-currency unit, or open trizum.",
    );
  }

  async get(party: Party, input: GetExpenseInput): Promise<ExpenseView> {
    const { expense } = await this.find(party, input.expenseId);

    const view: ExpenseView = {
      partyId: party.id,
      expenseId: expense.id,
      version: calculateExpenseHash(expense),
      currency: party.currency,
      name: expense.name,
      paidAt: expense.paidAt.toISOString(),
      amount: formatAmount(getExpenseTotalAmount(expense)),
      isTransfer: expense.isTransfer ?? false,
      paidBy: Object.entries(expense.paidBy).map(([participantId, amount]) => ({
        participantId,
        amount: formatAmount(amount),
      })),
      shares: Object.entries(expense.shares).map(([participantId, share]) => {
        const result: ExpenseView["shares"][number] = {
          participantId,
          type: share.type,
          value: share.value,
        };

        if (share.originalAmount !== undefined) result.originalAmount = share.originalAmount;

        return result;
      }),
    };

    if (expense.originalAmount)
      view.originalAmount = {
        amount: formatAmount(expense.originalAmount.amount),
        currency: expense.originalAmount.currency,
      };

    if (expense.exchangeRate !== undefined) view.exchangeRate = expense.exchangeRate;

    return view;
  }

  async update(party: Party, input: UpdateExpenseInput) {
    const { reference } = await this.find(party, input.expenseId);
    await this.documents.change<PartyExpenseChunk>(reference.chunkId, (doc) => {
      const { expense: current } = this.requireExpense(doc, input.expenseId, input.version);
      const updated = clone(current);

      if (input.name !== undefined) updated.name = input.name;

      if (input.paidAt !== undefined) updated.paidAt = new Date(input.paidAt);

      if (
        input.amount !== undefined ||
        input.paidBy !== undefined ||
        input.splitBetween !== undefined
      ) {
        if (current.originalAmount || current.exchangeRate !== undefined)
          throw new McpToolError(
            "Change foreign-currency amounts, payers, or splits in trizum to preserve the saved conversion. Only name and date edits are supported here.",
          );

        const payers = Object.keys(current.paidBy);

        const equal = Object.values(current.shares).every(
          (share) => share.type === "divide" && share.value === 1,
        );

        if ((payers.length !== 1 || !equal) && (!input.paidBy || !input.splitBetween))
          throw new McpToolError(
            "This expense has multiple payers or a custom split. Keep its financial fields unchanged, or obtain explicit instructions for a single payer and equal split, providing both paidBy and splitBetween.",
          );
        const payer = input.paidBy ?? payers[0];
        const split = input.splitBetween ?? Object.keys(current.shares);
        const historical = new Set([...payers, ...Object.keys(current.shares)]);

        for (const id of [payer, ...split]) {
          const person = party.participants[id];

          if (!Object.hasOwn(party.participants, id) || (person.isArchived && !historical.has(id)))
            throw new McpToolError(
              "Choose participant IDs from get_party. New references must use active participants.",
            );
        }

        if (split.length === 0 || new Set(split).size !== split.length)
          throw new McpToolError("Choose each participant in the split exactly once.");

        const amount =
          input.amount !== undefined
            ? parseExpenseAmount(input.amount)
            : getExpenseTotalAmount(current);

        if (!Number.isSafeInteger(amount) || amount <= 0)
          throw new McpToolError("Choose a positive expense amount.");
        updated.paidBy = { [payer]: amount };
        updated.shares = Object.fromEntries(split.map((id) => [id, { type: "divide", value: 1 }]));
      }

      delete updated.__editCopy;
      delete updated.__editCopyLastUpdatedAt;
      updated.__hash = calculateExpenseHash(updated);
      applyExpenseDiff(current, updated);
    });
    await this.reconcile(party, reference, input.expenseId);
  }

  async delete(party: Party, input: DeleteExpenseInput) {
    const { reference } = await this.find(party, input.expenseId);
    await this.documents.change<PartyExpenseChunk>(reference.chunkId, (doc) => {
      const { index } = this.requireExpense(doc, input.expenseId, input.version);
      deleteAt(doc.expenses, index);
    });
    await this.reconcile(party, reference, input.expenseId);
  }

  private requireExpense(chunk: PartyExpenseChunk, id: string, version: string) {
    const [expense, index] = findExpenseById(chunk.expenses, id);

    if (!expense || expense.id !== id)
      throw new McpToolError("Expense not found. Read the party again before choosing an expense.");

    if (expense.isTransfer)
      throw new McpToolError(
        "Edit or remove transfers in trizum so linked settlement records stay consistent.",
      );

    if (calculateExpenseHash(expense) !== version)
      throw new McpToolError(
        "This expense changed since it was read. Call get_expense again and confirm the intended changes before trying again.",
      );

    return { expense, index };
  }

  private async find(party: Party, id: string) {
    const { chunkId } = decodeExpenseId(id);
    const reference = party.chunkRefs.find((ref) => ref.chunkId === chunkId);

    if (!reference)
      throw new McpToolError(
        "This expense does not belong to the supplied party. Use an expense ID from trizum.",
      );
    const chunk = await this.readChunk(party, reference.chunkId);
    const [expense] = findExpenseById(chunk.expenses, id);

    if (!expense || expense.id !== id)
      throw new McpToolError("Expense not found. Read the party again before choosing an expense.");

    return { reference, expense };
  }

  private async reconcile(party: Party, reference: PartyExpenseChunkRef, expenseId: string) {
    // Re-read from the sync peer after every projection write. A live request repo
    // can still hold an older snapshot while another writer finishes.
    for (let attempt = 0; attempt < 4; attempt++) {
      const fresh = this.documents.fork();

      try {
        const reader = new PartyExpenses(fresh);
        const latestParty = await fresh.read<Party>(party.id);
        const chunk = await reader.readChunk(latestParty, reference.chunkId);
        const [edited] = findExpenseById(chunk.expenses, expenseId);

        if (edited?.id === expenseId && edited.__hash !== calculateExpenseHash(edited)) {
          await fresh.change<PartyExpenseChunk>(reference.chunkId, (doc) => {
            const [current] = findExpenseById(doc.expenses, expenseId);

            if (current?.id === expenseId) current.__hash = calculateExpenseHash(current);
          });
          continue;
        }

        await reader.readChunkBalances(latestParty, reference.balancesId);

        if (!(await recalculateChunkBalances(fresh, latestParty, reference))) return;
      } finally {
        await fresh.close();
      }
    }

    throw new McpToolError(
      "The expense change reached trizum but balances are still changing. Check the party state before retrying.",
    );
  }
  async readChunk(party: Party, chunkId: DocumentId) {
    const chunk = await this.documents.read<PartyExpenseChunk>(chunkId);

    if (
      chunk.type !== "expenseChunk" ||
      chunk.partyId !== party.id ||
      chunk.id !== chunkId ||
      !Array.isArray(chunk.expenses) ||
      chunk.expenses.length > 1000
    ) {
      throw new McpToolError("Invalid party expense document. Open the party in trizum.");
    }

    return chunk;
  }

  async readChunkBalances(party: Party, balancesId: DocumentId) {
    const summary = await this.documents.read<PartyExpenseChunkBalances>(balancesId);

    if (
      summary.type !== "expenseChunkBalances" ||
      summary.partyId !== party.id ||
      summary.id !== balancesId
    ) {
      throw new McpToolError("Invalid party balance document. Open the party in trizum.");
    }

    return summary;
  }
}

function parseExpenseAmount(value: string) {
  if (!addExpenseSchema.shape.amount.safeParse(value).success)
    throw new McpToolError(
      "The expense amount must be positive and have at most two decimal places.",
    );
  const amount = convertToUnits(Number(value));

  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new McpToolError(
      "The expense amount must be positive and have at most two decimal places.",
    );

  return amount;
}

export function formatAmount(amount: number) {
  if (!Number.isSafeInteger(amount))
    throw new McpToolError("This party contains an unsupported amount. Open it in trizum.");

  return toDecimal(createMoney(amount));
}
