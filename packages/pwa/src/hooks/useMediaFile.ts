import { fateMediaFileCache, useFateCache } from "#src/lib/data/fateAppData.ts";
import { useTrizumData } from "#src/lib/data/TrizumDataContext.ts";
import { decodeBlob } from "#src/models/media.ts";
import { useEffect, useMemo } from "react";

export function useMediaFile(mediaFileId: string) {
  if (!mediaFileId) {
    throw new Error("Malformed MediaFile ID");
  }

  const { client } = useTrizumData();
  const mediaFile = useFateCache(fateMediaFileCache, client, mediaFileId);

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
