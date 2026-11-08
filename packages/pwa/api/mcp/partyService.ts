import { UnconfirmedDocumentWriteError } from "../automergeDocuments";
import { MCP_HANDOFF_CAMPAIGN } from "@trizum/analytics";
import { createAiInviteUrl } from "../../src/lib/aiInvite";
import { isValidDocumentId, type DocumentId } from "@automerge/automerge-repo";
import {
  McpToolError,
  type PartyService,
  type PartyView,
  type CreatePartyInput,
  type AddExpenseInput,
  type AddParticipantsInput,
  type GetExpenseInput,
  type UpdatePartyInput,
  type UpdateParticipantInput,
  type UpdateExpenseInput,
  type DeleteExpenseInput,
} from "@trizum/mcp/index";
import { isCurrencyCode } from "../../src/lib/money";
import {
  calculateBalancesByParticipant,
  getExpenseTotalAmount,
  mergeBalancesByParticipant,
  type BalancesByParticipant,
  type Expense,
} from "../../src/models/expense";
import type { Party } from "../../src/models/party";

import { PartyExpenses, MAX_CHUNKS, formatAmount, type PartyDocuments } from "./expenseService";

export class WorkerPartyService implements PartyService {
  constructor(
    private readonly documents: PartyDocuments,
    private readonly origin: string,
  ) {
    this.expenses = new PartyExpenses(documents);
  }

  private readonly expenses: PartyExpenses;

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

    const party = await this.documents
      .create<Party>((id) => ({
        id,
        type: "party",
        name: input.name,
        description: input.description,
        symbol: input.symbol,
        currency,
        participants,
        chunkRefs: [],
      }))
      .catch((error) => {
        if (error instanceof UnconfirmedDocumentWriteError) {
          const url = createAiInviteUrl(this.origin, error.documentId, MCP_HANDOFF_CAMPAIGN);
          throw new McpToolError(
            `Party creation could not be confirmed. It may have reached trizum. Check ${url} with get_party before creating another party. Reuse the same requestId on retries.`,
          );
        }

        throw error;
      });

    return this.view(party, []);
  }

  async getParty(partyId: string): Promise<PartyView> {
    const party = await this.readParty(partyId);

    const summaries = await Promise.all(
      party.chunkRefs.map((ref) => this.expenses.readChunkBalances(party, ref.balancesId)),
    );

    const expenses: Expense[] = [];

    for (const ref of party.chunkRefs) {
      if (expenses.length >= 20) break;
      const chunk = await this.expenses.readChunk(party, ref.chunkId);
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
    await this.expenses.add(await this.readParty(input.partyId), input);

    return this.getParty(input.partyId);
  }

  async getExpense(input: GetExpenseInput) {
    return this.expenses.get(await this.readParty(input.partyId), input);
  }

  async updateExpense(input: UpdateExpenseInput) {
    await this.expenses.update(await this.readParty(input.partyId), input);

    return this.freshView(input.partyId);
  }

  async deleteExpense(input: DeleteExpenseInput) {
    await this.expenses.delete(await this.readParty(input.partyId), input);

    return this.freshView(input.partyId);
  }

  async updateParty(input: UpdatePartyInput) {
    const party = await this.readParty(input.partyId);
    await this.documents.change<Party>(party.id, (doc) => {
      if (input.name !== undefined) doc.name = input.name;

      if (input.description !== undefined) doc.description = input.description;

      if (input.symbol !== undefined) doc.symbol = input.symbol;
    });

    return this.getParty(party.id);
  }

  async updateParticipant(input: UpdateParticipantInput) {
    const party = await this.readParty(input.partyId);
    await this.documents.change<Party>(party.id, (doc) => {
      const person = doc.participants[input.participantId];

      if (!person) throw new McpToolError("Choose a participant ID from get_party.");

      if (
        input.name !== undefined &&
        Object.values(doc.participants).some(
          (other) =>
            other.id !== person.id &&
            other.name.trim().toLocaleLowerCase() === input.name!.trim().toLocaleLowerCase(),
        )
      )
        throw new McpToolError(
          "This participant name already exists. Ask for distinct display names.",
        );

      if (
        input.archived === true &&
        !Object.values(doc.participants).some(
          (other) => other.id !== person.id && !other.isArchived,
        )
      )
        throw new McpToolError("Keep at least one active participant in the party.");

      if (input.name !== undefined) person.name = input.name;

      if (input.archived !== undefined) person.isArchived = input.archived;
    });

    return this.getParty(party.id);
  }

  private async freshView(partyId: string) {
    const fresh = this.documents.fork();

    try {
      return await new WorkerPartyService(fresh, this.origin).getParty(partyId);
    } finally {
      await fresh.close();
    }
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

  private view(
    party: Party,
    expenses: Expense[],
    balances: BalancesByParticipant = calculateBalancesByParticipant(expenses, party.participants),
  ): PartyView {
    return {
      partyId: party.id,
      url: createAiInviteUrl(this.origin, party.id, MCP_HANDOFF_CAMPAIGN),
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
