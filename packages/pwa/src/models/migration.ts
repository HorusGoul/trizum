import type { DocumentId, Repo } from "@automerge/automerge-repo/slim";
import type { Party } from "./party";
import { getPartyHelpers } from "#src/hooks/useParty.ts";
import { getMediaFileHelpers } from "#src/hooks/useMediaFileActions.ts";
import type { MediaFile } from "./media";
import { compressionPresets } from "#src/lib/imageCompression.ts";
import { getLogger } from "#src/lib/log.ts";
import { requestIdleCallback } from "#src/lib/requestIdleCallback.ts";
import type { MigrationData } from "./migrationData";

export type { MigrationData } from "./migrationData";

const logger = getLogger("models", "migration");

interface CreatePartyFromMigrationDataParams {
  repo: Repo;
  data: MigrationData;
  importAttachments?: boolean;
  onProgress?: ({ name, progress }: { name: string; progress: number }) => void;
}

export async function createPartyFromMigrationData({
  repo,
  data,
  importAttachments = false,
  onProgress,
}: CreatePartyFromMigrationDataParams) {
  const { createMediaFile } = getMediaFileHelpers(repo);

  const party: Party = {
    id: "" as DocumentId,
    type: "party",
    name: data.party.name,
    description: data.party.description,
    currency: data.party.currency,
    participants: data.party.participants as Party["participants"],
    chunkRefs: [],
  };

  if (typeof data.party.symbol === "string") {
    party.symbol = data.party.symbol;
  }

  const handle = repo.create<Party>(party);
  handle.change((doc) => (doc.id = handle.documentId));
  const partyId = handle.documentId;

  // Import photos
  const photoMap = new Map<string, MediaFile["id"]>();
  if (importAttachments) {
    try {
      let importedPhotoCount = 0;

      await Promise.all(
        data.photos.map(async (photo) => {
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
          importedPhotoCount += 1;

          onProgress?.({
            name: `Importing attachments (${importedPhotoCount} of ${data.photos.length})`,
            progress: importedPhotoCount / data.photos.length,
          });
        }),
      );
    } catch (error) {
      logger.error("Failed to import photos during migration", { error });
      throw new Error(
        `Error importing photos: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  const helpers = getPartyHelpers(repo, handle);

  // Expenses from oldest to newest
  data.expenses.sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime());

  function waitIdleCallback(fn: () => Promise<void>) {
    return new Promise<void>((resolve) => {
      requestIdleCallback(() => {
        void fn().then(() => resolve());
      });
    });
  }

  // eslint-disable-next-line react-doctor/async-parallel -- Import writes must finish before flushing them and rebalancing from the worker repo.
  await importExpenseAtIndex(0);
  await flushPartyDocuments();
  await helpers.recalculateBalances();

  async function flushPartyDocuments() {
    const migratedParty = handle.doc();

    if (!migratedParty) {
      throw new Error("Party not found after migration, this should not happen");
    }

    await repo.flush([
      partyId,
      ...migratedParty.chunkRefs.flatMap((chunkRef) => [chunkRef.chunkId, chunkRef.balancesId]),
    ]);
  }

  async function importExpenseAtIndex(index: number): Promise<void> {
    const expense = data.expenses[index];

    if (!expense) {
      return;
    }

    await waitIdleCallback(async () => {
      await helpers.addExpenseToParty({
        name: expense.name,
        paidAt: new Date(expense.paidAt),
        shares: expense.shares,
        paidBy: expense.paidBy,
        photos: expense.photos
          .map((photoId) => photoMap.get(photoId))
          .filter((photoId): photoId is MediaFile["id"] => !!photoId),
      });
    }).catch((error) => {
      logger.error("Failed to import migrated expense", {
        error,
        expenseName: expense.name,
      });
      throw new Error(
        `Error importing expense ${expense.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    });

    onProgress?.({
      name: `Imported ${expense.name} (${index + 1} of ${data.expenses.length})`,
      progress: (index + 1) / data.expenses.length,
    });

    await importExpenseAtIndex(index + 1);
  }

  return partyId;
}
