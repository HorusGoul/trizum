import { getLogger } from "#src/lib/log.js";
import type {
  MigrationData,
  MigrationExpenseShare,
  MigrationParticipant,
} from "#src/models/migrationData.js";

const logger = getLogger("lib", "tricountMigration");

export interface TricountResponse {
  Response: Array<{
    Registry: {
      id: number;
      title: string;
      description: string | null;
      currency: string;
      memberships: Array<{
        RegistryMembershipNonUser: {
          id: number;
          alias: {
            display_name: string;
          };
        };
      }>;
      all_registry_entry: Array<{
        RegistryEntry: {
          id: number;
          amount: {
            currency: string;
            value: string;
          };
          description: string;
          date: string;
          type_transaction: string;
          membership_owned: {
            RegistryMembershipNonUser: {
              alias: {
                display_name: string;
              };
            };
          };
          allocations: Array<{
            amount: {
              currency: string;
              value: string;
            };
            membership: {
              RegistryMembershipNonUser: {
                alias: {
                  display_name: string;
                };
              };
            };
            type: string;
            share_ratio?: number;
          }>;
          attachment: Array<{
            urls?: Array<{
              url: string;
            }>;
          }>;
          category: string;
        };
      }>;
    };
    Token: {
      token: string;
    };
    UserPerson: {
      id: number;
    };
  }>;
}

export function parseTricountData(data: TricountResponse): MigrationData {
  const registry = data.Response[0].Registry;

  // Create photo mapping with temporary IDs
  const photoMap = new Map<string, string>();
  const photos: { id: string; url: string }[] = [];

  // Extract all photos from transactions
  for (const entry of registry.all_registry_entry) {
    const transaction = entry.RegistryEntry;
    for (const attachment of transaction.attachment) {
      if (attachment.urls && attachment.urls.length > 0) {
        const url = attachment.urls[0].url;
        if (!photoMap.has(url)) {
          const tempId = crypto.randomUUID();
          photoMap.set(url, tempId);
          photos.push({ id: tempId, url });
        }
      }
    }
  }

  // Create participants mapping
  const participants: Record<string, MigrationParticipant> = {};
  for (const membership of registry.memberships) {
    const member = membership.RegistryMembershipNonUser;
    const participantId = crypto.randomUUID();
    participants[participantId] = {
      id: participantId,
      name: member.alias.display_name,
    };
  }

  // Create name to participant ID mapping
  const nameToIdMap = new Map<string, string>();
  for (const [participantId, participant] of Object.entries(participants)) {
    nameToIdMap.set(participant.name, participantId);
  }

  // Transform expenses
  const expenses: (Omit<Expense, "id" | "__hash" | "paidAt" | "photos"> & {
    paidAt: string;
    photos: string[];
  })[] = [];

  for (const entry of registry.all_registry_entry) {
    const transaction = entry.RegistryEntry;

    const totalAmount = Math.abs(parseFloat(transaction.amount.value));
    const totalAmountInCents = Math.round(totalAmount * 100);
    const paidByName = transaction.membership_owned.RegistryMembershipNonUser.alias.display_name;
    const paidById = nameToIdMap.get(paidByName);

    if (!paidById) {
      logger.warning("Could not find participant ID for payer {paidByName}", {
        paidByName,
      });
      continue;
    }

    // Check if this is a transfer transaction
    const isTransfer = transaction.type_transaction === "BALANCE";

    // Create paidBy record
    const paidBy: Record<string, number> = {};
    paidBy[paidById] = totalAmountInCents;

    // Create shares record
    const shares: Record<string, MigrationExpenseShare> = {};

    for (const allocation of transaction.allocations) {
      const participantName = allocation.membership.RegistryMembershipNonUser.alias.display_name;
      const participantId = nameToIdMap.get(participantName);

      if (!participantId) {
        logger.warning("Could not find participant ID for participant {participantName}", {
          participantName,
        });
        continue;
      }

      const amount = Math.abs(parseFloat(allocation.amount.value));
      const amountInCents = Math.round(amount * 100);

      if (allocation.type === "AMOUNT") {
        if (amountInCents === 0) {
          continue;
        }

        shares[participantId] = {
          type: "exact",
          value: amountInCents,
        };
      } else if (allocation.type === "RATIO") {
        shares[participantId] = {
          type: "divide",
          value: allocation.share_ratio ?? 1,
        };
      }
    }

    // Create photos array for this expense
    const expensePhotos: string[] = [];
    for (const attachment of transaction.attachment) {
      if (attachment.urls && attachment.urls.length > 0) {
        const url = attachment.urls[0].url;
        const photoId = photoMap.get(url);
        if (photoId) {
          expensePhotos.push(photoId);
        }
      }
    }

    // Parse date
    const paidAt = new Date(transaction.date);

    const expense: MigrationData["expenses"][number] = {
      name: transaction.description,
      paidAt: paidAt.toISOString(),
      paidBy,
      shares,
      photos: expensePhotos,
      isTransfer,
      __editCopy: undefined,
      __editCopyLastUpdatedAt: undefined,
    };

    expenses.push(expense);
  }

  // Create party
  const party: MigrationData["party"] = {
    type: "party",
    name: registry.title,
    description: registry.description || "",
    currency: registry.currency as MigrationData["party"]["currency"],
    participants,
  };

  return {
    party,
    expenses,
    photos,
  };
}
