import type { Expense } from "./expense";
import type { Party } from "./party";

export interface MigrationData {
  party: Omit<Party, "id" | "chunkRefs">;
  expenses: (Omit<Expense, "id" | "__hash" | "paidAt"> & { paidAt: string })[];
  photos: { id: string; url: string }[];
}
