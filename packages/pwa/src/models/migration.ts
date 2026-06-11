import type { Expense } from "./expense";
import type { Party } from "./party";
import { getMediaFileHelpers } from "#src/hooks/useMediaFileActions.ts";
import type { MediaFile } from "./media";
import { compressionPresets } from "#src/lib/imageCompression.ts";
import { getLogger } from "#src/lib/log.ts";
import { requestIdleCallback } from "#src/lib/requestIdleCallback.ts";
import {
  createExpenseInFate,
  createPartyInFate,
  type CreatePartyValues,
} from "#src/lib/data/fateAppData.ts";
import type { TrizumFateClient } from "@trizum/data";

const logger = getLogger("models", "migration");

export interface MigrationData {
  party: Omit<Party, "id">;
  expenses: (Omit<Expense, "id" | "__hash" | "paidAt" | "photos"> & {
    paidAt: string;
    photos: string[];
  })[];
  photos: { id: string; url: string }[];
}

interface CreatePartyFromMigrationDataParams {
  client: TrizumFateClient;
  data: MigrationData;
  importAttachments?: boolean;
  onProgress?: ({ name, progress }: { name: string; progress: number }) => void;
  userId: string;
}

export async function createPartyFromMigrationData({
  client,
  data,
  importAttachments = false,
  onProgress,
  userId,
}: CreatePartyFromMigrationDataParams) {
  const { createMediaFile } = getMediaFileHelpers({ client, userId });
  const partyValues: CreatePartyValues = {
    name: data.party.name,
    description: data.party.description,
    currency: data.party.currency,
    participants: Object.values(data.party.participants),
  };

  if (typeof data.party.symbol === "string") {
    partyValues.symbol = data.party.symbol;
  }

  const party = await createPartyInFate({
    client,
    userId,
    values: partyValues,
  });
  const partyId = party.id;

  // Import photos
  const photoMap = new Map<string, MediaFile["id"]>();
  if (importAttachments) {
    try {
      for (let i = 0; i < data.photos.length; i++) {
        const photo = data.photos[i];
        const response = await fetch(photo.url);
        const blob = await response.blob();
        const [mediaFileId] = await createMediaFile(
          blob,
          {
            partyId,
          },
          compressionPresets.balanced,
        );
        photoMap.set(photo.id, mediaFileId);

        onProgress?.({
          name: `Importing attachments (${i + 1} of ${data.photos.length})`,
          progress: (i + 1) / data.photos.length,
        });
      }
    } catch (error) {
      logger.error("Failed to import photos during migration", { error });
      throw new Error(
        `Error importing photos: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Expenses from oldest to newest
  data.expenses.sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime());

  function waitIdleCallback(fn: () => Promise<void>) {
    return new Promise<void>((resolve) => {
      requestIdleCallback(() => {
        void fn().then(() => resolve());
      });
    });
  }

  for (let i = 0; i < data.expenses.length; i++) {
    const expense = data.expenses[i];

    await waitIdleCallback(async () => {
      await createExpenseInFate(client, partyId, {
        name: expense.name,
        paidAt: new Date(expense.paidAt),
        shares: expense.shares,
        paidBy: expense.paidBy,
        photos: expense.photos
          .map((photoId) => photoMap.get(photoId))
          .filter((photoId): photoId is MediaFile["id"] => !!photoId),
      }).catch((error) => {
        logger.error("Failed to import migrated expense", {
          error,
          expenseName: expense.name,
        });
        throw new Error(
          `Error importing expense ${expense.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      });
    });

    onProgress?.({
      name: `Imported ${expense.name} (${i + 1} of ${data.expenses.length})`,
      progress: (i + 1) / data.expenses.length,
    });
  }

  return partyId;
}
