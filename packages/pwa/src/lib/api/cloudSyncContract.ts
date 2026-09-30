import { isValidDocumentId, type DocumentId } from "@automerge/automerge-repo/slim";
import { z } from "zod";

export const cloudUserSettingsInputSchema = z.object({
  partyListDocumentId: z
    .string()
    .refine(isValidDocumentId)
    .transform((id) => id as DocumentId),
});

export const cloudUserSettingsSchema = cloudUserSettingsInputSchema.extend({
  updatedAt: z.number().int().nonnegative(),
});

export const getCloudUserSettingsResponseSchema = z.object({
  settings: cloudUserSettingsSchema.nullable(),
});

export const saveCloudUserSettingsResponseSchema = z.object({
  settings: cloudUserSettingsSchema,
});

export const cloudSyncErrorResponseSchema = z.object({ error: z.string() });

export type CloudUserSettings = z.infer<typeof cloudUserSettingsSchema>;
export type CloudUserSettingsInput = z.infer<typeof cloudUserSettingsInputSchema>;
export type GetCloudUserSettingsResponse = z.infer<typeof getCloudUserSettingsResponseSchema>;
export type SaveCloudUserSettingsResponse = z.infer<typeof saveCloudUserSettingsResponseSchema>;
