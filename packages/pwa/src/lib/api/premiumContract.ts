import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import { z } from "zod";

export const partyBoostRevocationReasonSchema = z.enum(["owner_not_member", "premium_inactive"]);

export const partyBoostErrorCodeSchema = z.enum([
  "already_boosted",
  "invalid_party",
  "membership_required",
  "premium_required",
  "transfer_locked",
  "unauthorized",
  "unavailable",
]);

export const partyDocumentIdSchema = z
  .string()
  .refine((value): boolean => isValidDocumentId(value), "Party document ID is invalid.");

export const partyBoostAssignmentStatusSchema = z.strictObject({
  active: z.boolean(),
  assignedAt: z.number().int().nonnegative(),
  partyDocumentId: partyDocumentIdSchema,
  revocationReason: partyBoostRevocationReasonSchema.nullable(),
  revokedAt: z.number().int().nonnegative().nullable(),
  transferableAt: z.number().int().nonnegative(),
});

export const partyBoostStatusSchema = z.strictObject({
  currentUser: z.strictObject({
    assignment: partyBoostAssignmentStatusSchema.nullable(),
    isPremium: z.boolean(),
  }),
  party: z.strictObject({
    isBoosted: z.boolean(),
    isBoostedByCurrentUser: z.boolean(),
  }),
});

export const partyBoostErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: partyBoostErrorCodeSchema,
    message: z.string(),
    transferableAt: z.number().int().nonnegative().optional(),
  }),
});

export const partyBoostQuerySchema = z.strictObject({
  partyDocumentId: partyDocumentIdSchema,
});

export const partyBoostRequestSchema = z.strictObject({
  partyDocumentId: partyDocumentIdSchema,
});

export type PartyBoostAssignmentStatus = z.infer<typeof partyBoostAssignmentStatusSchema>;
export type PartyBoostErrorCode = z.infer<typeof partyBoostErrorCodeSchema>;
export type PartyBoostErrorResponse = z.infer<typeof partyBoostErrorResponseSchema>;
export type PartyBoostRevocationReason = z.infer<typeof partyBoostRevocationReasonSchema>;
export type PartyBoostStatus = z.infer<typeof partyBoostStatusSchema>;
