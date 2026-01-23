/**
 * Re-export automerge utilities from @trizum/sdk.
 */
import type { DocumentId, TrizumClient } from "@trizum/sdk";

export async function loadDocumentsByIds<T>(
  client: TrizumClient,
  ids: DocumentId[],
): Promise<T[]> {
  const docs = await client.loadMany<T>(ids);
  return docs.filter((doc): doc is T => doc !== undefined);
}
