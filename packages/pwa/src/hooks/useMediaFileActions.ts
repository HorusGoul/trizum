import { encodeBlob, type MediaFile } from "#src/models/media.ts";
import { RawString, type DocumentId } from "@automerge/automerge-repo";
import { useRepo } from "@automerge/automerge-repo-react-hooks";

export function useMediaFileActions() {
  const repo = useRepo();

  async function createMediaFile(
    blob: Blob,
    metadata: Record<string, unknown>,
  ) {
    const handle = repo.create<MediaFile>({
      id: "id" as DocumentId,
      encodedBlob: new RawString(await encodeBlob(blob)),
      metadata,
    });

    handle.change((doc) => {
      doc.id = handle.documentId;
    });

    return [handle.documentId, handle] as const;
  }

  return {
    createMediaFile,
  };
}
