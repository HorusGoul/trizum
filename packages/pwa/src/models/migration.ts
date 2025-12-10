import type { DocumentId, Repo } from "@automerge/automerge-repo/slim";
import type { Expense } from "./expense";
import type { Party } from "./party";
import { getPartyHelpers } from "#src/hooks/useParty.ts";
import { getMediaFileHelpers } from "#src/hooks/useMediaFileActions.ts";
import type { MediaFile } from "./media";
import { compressionPresets } from "#src/lib/imageCompression.ts";

export interface MigrationData {
  party: Omit<Party, "id" | "chunkRefs">;
  expenses: (Omit<Expense, "id" | "__hash" | "paidAt" | "photos"> & {
    paidAt: string;
    photos: string[];
  })[];
  photos: { id: string; url: string }[];
}

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

  const handle = repo.create<Party>({
    id: "" as DocumentId,
    type: "party",
    name: data.party.name,
    description: data.party.description,
    currency: data.party.currency,
    participants: data.party.participants,
    chunkRefs: [],
  });
  handle.change((doc) => (doc.id = handle.documentId));
  const partyId = handle.documentId;

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
      console.error(error);
      throw new Error(
        `Error importing photos: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  const helpers = getPartyHelpers(repo, handle);

  // Expenses from oldest to newest
  data.expenses.sort(
    (a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime(),
  );

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
      await helpers
        .addExpenseToParty({
          name: expense.name,
          paidAt: new Date(expense.paidAt),
          shares: expense.shares,
          paidBy: expense.paidBy,
          photos: expense.photos
            .map((photoId) => photoMap.get(photoId))
            .filter((photoId): photoId is MediaFile["id"] => !!photoId),
        })
        .catch((error) => {
          console.error(error);
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
