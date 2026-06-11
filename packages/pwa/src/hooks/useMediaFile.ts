import { toMediaFile } from "#src/lib/data/fateAppData.ts";
import { useFateLiveView, useFateRequest } from "#src/lib/data/fateReact.ts";
import { decodeBlob } from "#src/models/media.ts";
import { MediaFileBlobView } from "@trizum/data";
import { useEffect, useMemo } from "react";

export function useMediaFile(mediaFileId: string) {
  if (!mediaFileId) {
    throw new Error("Malformed MediaFile ID");
  }

  const { mediaFile: mediaFileRef } = useFateRequest({
    mediaFile: {
      id: mediaFileId,
      view: MediaFileBlobView,
    },
  });
  const mediaFileEntity = useFateLiveView(MediaFileBlobView, mediaFileRef);
  const mediaFile = toMediaFile(mediaFileEntity);

  if (!mediaFile) {
    throw new Error("MediaFile not found");
  }

  const url = useMemo(() => {
    const mimeType =
      typeof mediaFile.metadata.mimeType === "string" ? mediaFile.metadata.mimeType : undefined;
    const blob = decodeBlob(mediaFile.encodedBlob, mimeType);
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
