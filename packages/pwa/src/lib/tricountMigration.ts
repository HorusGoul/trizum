import { getLogger } from "#src/lib/log.js";
import type {
  MigrationData,
  MigrationExpenseShare,
  MigrationParticipant,
} from "#src/models/migrationData.js";

const logger = getLogger("lib", "tricountMigration");

interface TricountMembership {
  id: number;
  alias: {
    display_name: string;
  };
}

interface TricountMembershipReference {
  id?: number;
  alias: {
    display_name: string;
  };
}

type TricountRegistry = TricountResponse["Response"][number]["Registry"];
type TricountRegistryMembership = TricountRegistry["memberships"][number];
type TricountRegistryEntry = TricountRegistry["all_registry_entry"][number];
type TricountAllocation = TricountRegistryEntry["RegistryEntry"]["allocations"][number];

export interface TricountResponse {
  Response: Array<{
    Registry: {
      id: number;
      title: string;
      description: string | null;
      currency: string;
      memberships: Array<{
        RegistryMembershipNonUser: TricountMembership;
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
            RegistryMembershipNonUser: TricountMembershipReference;
          };
          allocations: Array<{
            amount: {
              currency: string;
              value: string;
            };
            membership: {
              RegistryMembershipNonUser: TricountMembershipReference;
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
  const registryEntries = registry.all_registry_entry.slice().sort(compareRegistryEntries);

  // Create photo mapping with temporary IDs
  const photoMap = new Map<string, string>();
  const photos: { id: string; url: string }[] = [];

  // Extract all photos from transactions
  for (const entry of registryEntries) {
    const transaction = entry.RegistryEntry;
    for (const attachment of transaction.attachment) {
      if (attachment.urls && attachment.urls.length > 0) {
        const url = attachment.urls[0].url;
        if (!photoMap.has(url)) {
          const tempId = `tricount-photo-${photoMap.size + 1}`;
          photoMap.set(url, tempId);
          photos.push({ id: tempId, url });
        }
      }
    }
  }

  // Create participants mapping
  const participants: Record<string, MigrationParticipant> = {};
  const participantIdByMembershipId = new Map<number, string>();
  const participantIdByName = new Map<string, string>();
  const memberships = registry.memberships.slice().sort(compareMembershipEntries);

  for (const membership of memberships) {
    const member = membership.RegistryMembershipNonUser;
    const memberName = member.alias.display_name;
    const participantId = createParticipantId(member.id);
    participants[participantId] = {
      id: participantId,
      name: memberName,
    };

    participantIdByMembershipId.set(member.id, participantId);

    if (!participantIdByName.has(memberName)) {
      participantIdByName.set(memberName, participantId);
    }
  }

  // Transform expenses
  const expenses: (Omit<Expense, "id" | "__hash" | "paidAt" | "photos"> & {
    paidAt: string;
    photos: string[];
  })[] = [];

  for (const entry of registryEntries) {
    const transaction = entry.RegistryEntry;

    const totalAmount = Math.abs(parseFloat(transaction.amount.value));
    const totalAmountInCents = Math.round(totalAmount * 100);
    const paidByMember = transaction.membership_owned.RegistryMembershipNonUser;
    const paidByName = paidByMember.alias.display_name;
    const paidById = getParticipantId(
      paidByMember,
      participantIdByMembershipId,
      participantIdByName,
    );

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

    for (const allocation of transaction.allocations.slice().sort(compareAllocations)) {
      const participantMember = allocation.membership.RegistryMembershipNonUser;
      const participantName = participantMember.alias.display_name;
      const participantId = getParticipantId(
        participantMember,
        participantIdByMembershipId,
        participantIdByName,
      );

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

function createParticipantId(membershipId: number) {
  return `tricount-membership-${membershipId}`;
}

function getParticipantId(
  member: TricountMembershipReference,
  participantIdByMembershipId: Map<number, string>,
  participantIdByName: Map<string, string>,
) {
  if (typeof member.id === "number") {
    return participantIdByMembershipId.get(member.id);
  }

  return participantIdByName.get(member.alias.display_name);
}

function compareMembershipEntries(
  left: TricountRegistryMembership,
  right: TricountRegistryMembership,
) {
  return compareMemberships(left.RegistryMembershipNonUser, right.RegistryMembershipNonUser);
}

function compareAllocations(left: TricountAllocation, right: TricountAllocation) {
  return compareMemberships(
    left.membership.RegistryMembershipNonUser,
    right.membership.RegistryMembershipNonUser,
  );
}

function compareMemberships(left: TricountMembershipReference, right: TricountMembershipReference) {
  const idDifference = (left.id ?? Number.MAX_SAFE_INTEGER) - (right.id ?? Number.MAX_SAFE_INTEGER);

  if (idDifference !== 0) {
    return idDifference;
  }

  return left.alias.display_name.localeCompare(right.alias.display_name);
}

function compareRegistryEntries(left: TricountRegistryEntry, right: TricountRegistryEntry) {
  const leftEntry = left.RegistryEntry;
  const rightEntry = right.RegistryEntry;
  const dateDifference = getDateTimestamp(leftEntry.date) - getDateTimestamp(rightEntry.date);

  if (dateDifference !== 0) {
    return dateDifference;
  }

  if (leftEntry.id !== rightEntry.id) {
    return leftEntry.id - rightEntry.id;
  }

  return leftEntry.description.localeCompare(rightEntry.description);
}

function getDateTimestamp(date: string) {
  const timestamp = Date.parse(date);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}
