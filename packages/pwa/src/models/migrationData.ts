import type { z } from "zod";
import type {
  migrationDataSchema,
  migrationExpenseSchema,
  migrationExpenseShareSchema,
  migrationParticipantSchema,
} from "#src/lib/api/migrationContract.ts";

export type MigrationData = z.infer<typeof migrationDataSchema>;
export type MigrationParticipant = z.infer<typeof migrationParticipantSchema>;
export type MigrationExpense = z.infer<typeof migrationExpenseSchema>;
export type MigrationExpenseShare = z.infer<typeof migrationExpenseShareSchema>;
