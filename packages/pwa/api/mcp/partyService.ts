import { isValidDocumentId, type DocumentId } from "@automerge/automerge-repo";
import {
  McpToolError,
  type PartyService,
  type PartyView,
  type CreatePartyInput,
  type AddExpenseInput,
  type AddParticipantsInput,
} from "@trizum/mcp/index";
import type { AutomergeDocuments } from "../automergeDocuments";
import { isCurrencyCode } from "../../src/lib/money";
import {
  calculateBalancesByParticipant,
  calculateExpenseHash,
  createExpenseId,
  getExpenseTotalAmount,
  mergeBalancesByParticipant,
  type BalancesByParticipant,
  type Expense,
} from "../../src/models/expense";
import type { Party, PartyExpenseChunk, PartyExpenseChunkBalances } from "../../src/models/party";

type PartyDocuments = Pick<AutomergeDocuments, "read" | "create" | "change">;

const MAX_CHUNKS = 100;

export class WorkerPartyService implements PartyService {
  constructor(
    private readonly documents: PartyDocuments,
    private readonly origin: string,
  ) {}

  async createParty(input: CreatePartyInput): Promise<PartyView> {
    if (!isCurrencyCode(input.currency))
      throw new McpToolError("Unsupported currency. Choose a currency supported by trizum.");

    if (
      new Set(input.participants.map((name) => name.toLocaleLowerCase())).size !==
      input.participants.length
    ) {
      throw new McpToolError(
        "Use distinct participant names so the group can identify each person.",
      );
    }

    const currency = input.currency;

    const participants = Object.fromEntries(
      input.participants.map((name) => {
        const id = crypto.randomUUID();

        return [id, { id, name }];
      }),
    );

    const party = await this.documents.create<Party>((id) => ({
      id,
      type: "party",
      name: input.name,
      description: input.description,
      symbol: input.symbol,
      currency,
      participants,
      chunkRefs: [],
    }));

    return this.view(party, []);
  }

  async getParty(partyId: string): Promise<PartyView> {
    const party = await this.readParty(partyId);

    const summaries = await Promise.all(
      party.chunkRefs.map((ref) => this.readChunkBalances(party, ref.balancesId)),
    );

    const expenses: Expense[] = [];

    for (const ref of party.chunkRefs) {
      if (expenses.length >= 20) break;
      const chunk = await this.readChunk(party, ref.chunkId);
      const recent = chunk.expenses.toSorted((a, b) => b.id.localeCompare(a.id));
      expenses.push(...recent.slice(0, 20 - expenses.length));
    }

    const balances = mergeBalancesByParticipant(
      ...summaries.map((summary) => structuredClone(summary.balances)),
    );

    return this.view(party, expenses, balances);
  }

  async addParticipants(input: AddParticipantsInput): Promise<PartyView> {
    const party = await this.readParty(input.partyId);
    const participants = input.participants.map((name) => ({ id: crypto.randomUUID(), name }));

    await this.documents.change<Party>(party.id, (doc) => {
      const names = new Set(
        Object.values(doc.participants).map((person) => person.name.trim().toLocaleLowerCase()),
      );

      for (const person of participants) {
        const normalized = person.name.trim().toLocaleLowerCase();

        if (names.has(normalized))
          throw new McpToolError(
            "A participant with this name already exists or appears twice. Reuse IDs from get_party, or ask for distinct display names.",
          );
        names.add(normalized);
      }

      if (Object.keys(doc.participants).length + participants.length > 50)
        throw new McpToolError(
          "This party has too many participants for this integration. Open it in trizum to add more people.",
        );

      // Add individual entries so concurrent additions preserve every existing participant.
      for (const person of participants) doc.participants[person.id] = person;
    });

    return this.getParty(party.id);
  }

  async addExpense(input: AddExpenseInput): Promise<PartyView> {
    const party = await this.readParty(input.partyId);
    const amount = parseExpenseAmount(input.amount);
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

    // Independent requests must not replace the same derived balance map.
    // Publish a completed chunk and its balance before merging its party reference.
    // maxSize: 1 also makes normal PWA appends start a new chunk.
    const chunk = await this.documents.create<PartyExpenseChunk>((id) => {
      const expense: Expense = {
        id: createExpenseId(id),
        name: input.name,
        paidAt: new Date(input.paidAt),
        paidBy: { [input.paidBy]: amount },
        shares: Object.fromEntries(
          input.splitBetween.map((id) => [id, { type: "divide", value: 1 }]),
        ),
        photos: [],
        __hash: "",
      };

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

    return this.getParty(party.id);
  }

  private async readParty(id: string) {
    if (!isValidDocumentId(id))
      throw new McpToolError("Invalid party ID. Use the ID from a trizum invite link.");
    // SAFETY: isValidDocumentId validates this opaque Automerge identifier before any sync lookup.
    const party = await this.documents.read<Party>(id as DocumentId);

    if (
      party.type !== "party" ||
      party.id !== id ||
      !isCurrencyCode(party.currency) ||
      !party.chunkRefs ||
      !party.participants ||
      Object.keys(party.participants).length === 0
    ) {
      throw new McpToolError("This link is not a supported trizum party.");
    }

    if (party.chunkRefs.length > MAX_CHUNKS)
      throw new McpToolError("This party is too large for this integration. Open it in trizum.");

    return party;
  }

  private async readChunk(party: Party, chunkId: DocumentId) {
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

  private async readChunkBalances(party: Party, balancesId: DocumentId) {
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

  private view(
    party: Party,
    expenses: Expense[],
    balances: BalancesByParticipant = calculateBalancesByParticipant(expenses, party.participants),
  ): PartyView {
    return {
      partyId: party.id,
      url: new URL(`/party/${party.id}`, this.origin).href,
      name: party.name,
      description: party.description,
      symbol: party.symbol ?? "🏝️",
      currency: party.currency,
      participants: Object.values(party.participants).map((person) => ({
        id: person.id,
        name: person.name,
        archived: person.isArchived ?? false,
        balance: formatAmount(balances[person.id]?.stats.balance ?? 0),
      })),
      expenses: expenses
        .toSorted((a, b) => b.id.localeCompare(a.id))
        .slice(0, 20)
        .map((expense) => ({
          id: expense.id,
          name: expense.name,
          paidAt: expense.paidAt.toISOString(),
          amount: formatAmount(getExpenseTotalAmount(expense)),
        })),
    };
  }
}

function parseExpenseAmount(value: string) {
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value))
    throw new McpToolError(
      "The expense amount must be positive and have at most two decimal places.",
    );
  const [units, decimals = ""] = value.split(".");
  const amount = Number(units) * 100 + Number(decimals.padEnd(2, "0"));

  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new McpToolError(
      "The expense amount must be positive and have at most two decimal places.",
    );

  return amount;
}

function formatAmount(amount: number) {
  if (!Number.isSafeInteger(amount))
    throw new McpToolError("This party contains an unsupported amount. Open it in trizum.");
  const absolute = Math.abs(amount);

  return `${amount < 0 ? "-" : ""}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}
