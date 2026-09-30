import { z } from "zod";
import { isCurrencyCode, type CurrencyCode } from "../money";

export const migrationParticipantSchema = z.object({
  avatarId: z.string().nullable().optional(),
  balancesSortedBy: z.enum(["name", "balance-ascending", "balance-descending"]).optional(),
  id: z.string(),
  isArchived: z.boolean().optional(),
  name: z.string(),
  personalMode: z.boolean().optional(),
  phone: z.string().optional(),
});

export const migrationExpenseShareSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("divide"),
    value: z.number(),
    calculatedExact: z.number().optional(),
  }),
  z.object({ type: z.literal("exact"), value: z.number() }),
]);

export const migrationExpenseSchema = z.object({
  isTransfer: z.boolean().optional(),
  name: z.string(),
  paidAt: z.iso.datetime(),
  paidBy: z.record(z.string(), z.number()),
  photos: z.array(z.string()),
  shares: z.record(z.string(), migrationExpenseShareSchema),
});

export const migrationDataSchema = z.object({
  party: z.object({
    currency: z
      .string()
      .refine(isCurrencyCode)
      .transform((value) => value as CurrencyCode),
    description: z.string(),
    name: z.string(),
    participants: z.record(z.string(), migrationParticipantSchema),
    symbol: z.string().optional(),
    type: z.literal("party"),
  }),
  expenses: z.array(migrationExpenseSchema),
  photos: z.array(z.object({ id: z.string(), url: z.string() })),
});

export const migrationQuerySchema = z.object({ key: z.string().min(1) });
export const migrationBadRequestSchema = z.literal("Missing 'key' query parameter");
export const migrationErrorResponseSchema = z.object({
  error: z.string(),
  // The legacy error includes the upstream response for diagnostics, when available.
  data: z.unknown().refine((value) => value !== undefined),
});
