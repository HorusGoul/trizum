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
    const mimeType =
      typeof mediaFile.metadata.mimeType === "string"
        ? mediaFile.metadata.mimeType
        : undefined;
    const blob = decodeBlob(mediaFile.encodedBlob.val, mimeType);
    return URL.createObjectURL(blob);
  }, [mediaFile.encodedBlob, mediaFile.metadata.mimeType]);

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
