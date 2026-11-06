import { z } from "zod";

const name = z.string().trim().min(1).max(120);
const participantId = z.string().min(1).max(100);

const requestId = z
  .string()
  .min(1)
  .max(2048)
  .describe(
    "The 15-minute write token returned by prepare_write for this operation. Reuse it unchanged on retries; never generate your own.",
  );

export const prepareWriteSchema = z.object({
  operation: z.enum(["create_party", "add_participants", "add_expense"]),
});

export const preparedWriteSchema = z.object({ requestId: z.string(), expiresAt: z.iso.datetime() });

export type PrepareWriteInput = z.infer<typeof prepareWriteSchema>;

export type PreparedWrite = z.infer<typeof preparedWriteSchema>;

export type WriteOperation = PrepareWriteInput["operation"];

const partyId = z
  .string()
  .min(1)
  .max(100)
  .describe(
    "The party ID returned by trizum, or the ID in a user-provided /party/{id} invite link. Never guess IDs.",
  );

export const createPartySchema = z.object({
  requestId,
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
  requestId,
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
  requestId,
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
}

export interface McpService extends PartyService {
  prepareWrite(input: PrepareWriteInput): Promise<PreparedWrite>;
}

/** Only explicitly public messages may cross the MCP error boundary. */
export class McpToolError extends Error {}
