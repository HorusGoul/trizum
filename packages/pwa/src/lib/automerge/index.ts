import type { Doc, DocumentId, Repo } from "@automerge/automerge-repo/slim";

export async function loadDocumentsByIds<T>(
  repo: Repo,
  ids: DocumentId[],
): Promise<Doc<T>[]> {
  return (
    await Promise.all(
      ids.map(async (id) => {
        const handle = repo.find<T>(id);
        return await handle.doc();
      }),
    )
  ).filter((doc) => !!doc);
}
