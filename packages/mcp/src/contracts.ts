import { z } from "zod";

const name = z.string().trim().min(1).max(120);
const participantId = z.string().min(1).max(100);

const partyId = z
  .string()
  .min(1)
  .max(100)
  .describe(
    "The party ID returned by trizum, or the ID in a user-provided /party/{id} invite link. Never guess IDs.",
  );

export const createPartySchema = z.object({
  name: name.describe("The group's name, such as Lisbon weekend or Home expenses."),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .describe(
      "The currency explicitly chosen by the user, as an ISO code such as EUR. Ask if unclear.",
    ),
  participants: z
    .array(name)
    .min(1)
    .max(50)
    .describe(
      "Participant display names, including the user. Ask about ambiguous or duplicate names before creating.",
    ),
  description: z.string().max(1000).default(""),
  symbol: z.string().max(16).default("🏝️"),
});

export const getPartySchema = z.object({ partyId });

export const addParticipantsSchema = z.object({
  partyId,
  participants: z
    .array(name)
    .min(1)
    .max(50)
    .describe(
      "New participant display names to add to this party. Reuse existing people from get_party; ask about ambiguous names. Adding people never changes previous expense splits.",
    ),
});

export const addExpenseSchema = z.object({
  partyId,
  name: name.describe("What the expense was for."),
  amount: z
    .string()
    .regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
    .describe(
      "Positive total in the party's currency, as a decimal string, e.g. '42.50'. trizum supports up to two decimal places for every currency. Never convert currencies implicitly.",
    ),
  paidBy: participantId.describe(
    "The payer's participant ID returned by get_party, never a display name.",
  ),
  splitBetween: z
    .array(participantId)
    .min(1)
    .max(50)
    .describe(
      "Participant IDs sharing the expense equally, including the payer only if they share it. Confirm who is included; never infer from the payer alone.",
    ),
  paidAt: z.iso
    .datetime({ offset: true })
    .describe("The expense date/time in ISO 8601 format with a timezone."),
});

const expenseId = z
  .string()
  .min(1)
  .max(180)
  .describe("The exact expense ID returned by trizum; never guess IDs.");

const version = z
  .string()
  .regex(/^[a-f0-9]{32}$/)
  .describe(
    "The current version returned by get_expense. Read again after a conflict; never silently overwrite a newer edit.",
  );

export const getExpenseSchema = z.object({ partyId, expenseId });

export const updatePartySchema = z
  .object({
    partyId,
    name: name.optional(),
    description: z.string().max(1000).optional(),
    symbol: z.string().max(16).optional(),
  })
  .refine(
    (input) =>
      input.name !== undefined || input.description !== undefined || input.symbol !== undefined,
    "Provide at least one party detail to change.",
  );

export const updateParticipantSchema = z
  .object({
    partyId,
    participantId,
    name: name.optional(),
    archived: z
      .boolean()
      .optional()
      .describe(
        "Archive to remove from the active group while preserving history, or false to restore. Never erase an existing participant.",
      ),
  })
  .refine(
    (input) => input.name !== undefined || input.archived !== undefined,
    "Provide a name or archive state to change.",
  );

export const updateExpenseSchema = z
  .object({
    partyId,
    expenseId,
    version,
    name: addExpenseSchema.shape.name.optional(),
    amount: addExpenseSchema.shape.amount.optional(),
    paidBy: addExpenseSchema.shape.paidBy.optional(),
    splitBetween: addExpenseSchema.shape.splitBetween.optional(),
    paidAt: addExpenseSchema.shape.paidAt.optional(),
  })
  .refine(
    (input) =>
      [input.name, input.amount, input.paidBy, input.splitBetween, input.paidAt].some(
        (value) => value !== undefined,
      ),
    "Provide at least one expense field to change.",
  );

export const deleteExpenseSchema = z.object({ partyId, expenseId, version });

export const expenseViewSchema = z.object({
  partyId: z.string(),
  expenseId: z.string(),
  version: z.string(),
  currency: z.string(),
  name: z.string(),
  paidAt: z.string(),
  amount: z.string(),
  originalAmount: z
    .object({ amount: z.string(), currency: z.string() })
    .optional()
    .describe("Saved original amount as a decimal string in its original currency."),
  exchangeRate: z
    .number()
    .positive()
    .optional()
    .describe("Saved party-currency units per original-currency unit; never refreshed on read."),
  isTransfer: z.boolean(),
  paidBy: z.array(z.object({ participantId: z.string(), amount: z.string() })),
  shares: z
    .array(
      z.object({
        participantId: z.string(),
        type: z.enum(["divide", "exact"]),
        value: z.number(),
        originalAmount: z
          .number()
          .optional()
          .describe("Saved share amount in integer hundredths of the original currency."),
      }),
    )
    .describe(
      "Divide values are relative weights; exact values are integer hundredths of the party currency.",
    ),
});

export type GetExpenseInput = z.infer<typeof getExpenseSchema>;

export type UpdatePartyInput = z.infer<typeof updatePartySchema>;

export type UpdateParticipantInput = z.infer<typeof updateParticipantSchema>;

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export type DeleteExpenseInput = z.infer<typeof deleteExpenseSchema>;

export type ExpenseView = z.infer<typeof expenseViewSchema>;

export const partyViewSchema = z.object({
  partyId: z.string(),
  url: z.url(),
  name: z.string(),
  symbol: z.string(),
  description: z.string(),
  currency: z.string(),
  participants: z.array(
    z.object({ id: z.string(), name: z.string(), archived: z.boolean(), balance: z.string() }),
  ),
  expenses: z.array(
    z.object({ id: z.string(), name: z.string(), amount: z.string(), paidAt: z.string() }),
  ),
});

export type CreatePartyInput = z.infer<typeof createPartySchema>;

export type AddParticipantsInput = z.infer<typeof addParticipantsSchema>;

export type AddExpenseInput = z.infer<typeof addExpenseSchema>;

export type PartyView = z.infer<typeof partyViewSchema>;

/** The host owns persistence, sync, and the existing trizum domain rules. */
export interface PartyService {
  createParty(input: CreatePartyInput): Promise<PartyView>;
  getParty(partyId: string): Promise<PartyView>;
  addExpense(input: AddExpenseInput): Promise<PartyView>;
  addParticipants(input: AddParticipantsInput): Promise<PartyView>;
  getExpense(input: GetExpenseInput): Promise<ExpenseView>;
  updateParty(input: UpdatePartyInput): Promise<PartyView>;
  updateParticipant(input: UpdateParticipantInput): Promise<PartyView>;
  updateExpense(input: UpdateExpenseInput): Promise<PartyView>;
  deleteExpense(input: DeleteExpenseInput): Promise<PartyView>;
}

/** Only explicitly public messages may cross the MCP error boundary. */
export class McpToolError extends Error {}
