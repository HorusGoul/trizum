/**
 * Re-export automerge utilities from @trizum/sdk.
 */
import type { DocumentId, Repo } from "@trizum/sdk";

export async function loadDocumentsByIds<T>(
  repo: Repo,
  ids: DocumentId[],
): Promise<T[]> {
  const docs: (T | undefined)[] = await Promise.all(
    ids.map(async (id) => {
      const handle = await repo.find<T>(
        id as unknown as Parameters<typeof repo.find>[0],
      );
      return handle.doc() as T | undefined;
    }),
  );
  return docs.filter((doc): doc is T => doc !== undefined);
}
