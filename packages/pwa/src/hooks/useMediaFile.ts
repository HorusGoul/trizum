import { useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.ts";
import { decodeBlob, type MediaFile } from "#src/models/media.ts";
import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import { useEffect, useMemo } from "react";

export function useMediaFile(mediaFileId: string) {
  if (!isValidDocumentId(mediaFileId)) {
    throw new Error("Malformed MediaFile ID");
  }

  const [mediaFile] = useSuspenseDocument<MediaFile>(mediaFileId, {
    required: true,
  });

  const url = useMemo(() => {
    const blob = decodeBlob(mediaFile.encodedBlob.val);
    return URL.createObjectURL(blob);
  }, [mediaFile.encodedBlob]);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [url]);

  return {
    mediaFile,
    mediaFileId,
    url,
  };
}
