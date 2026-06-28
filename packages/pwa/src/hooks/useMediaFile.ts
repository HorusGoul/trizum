import { useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.ts";
import { decodeBlob, type MediaFile } from "#src/models/media.ts";
import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import { useEffect } from "react";

interface MediaFileObjectUrlEntry {
  key: string;
  refCount: number;
  url: string;
}

const mediaFileObjectUrlCache = new Map<string, MediaFileObjectUrlEntry>();

function getMediaFileMimeType(mediaFile: MediaFile) {
  return typeof mediaFile.metadata.mimeType === "string" ? mediaFile.metadata.mimeType : undefined;
}

function getMediaFileObjectUrlKey(mediaFile: MediaFile) {
  return `${getMediaFileMimeType(mediaFile) ?? ""}\0${mediaFile.encodedBlob.val}`;
}

function getOrCreateMediaFileObjectUrlEntry(mediaFile: MediaFile) {
  const key = getMediaFileObjectUrlKey(mediaFile);
  const cachedEntry = mediaFileObjectUrlCache.get(key);

  if (cachedEntry) {
    return cachedEntry;
  }

  const blob = decodeBlob(mediaFile.encodedBlob.val, getMediaFileMimeType(mediaFile));
  const entry = {
    key,
    refCount: 0,
    url: URL.createObjectURL(blob),
  };

  mediaFileObjectUrlCache.set(key, entry);
  return entry;
}

function retainMediaFileObjectUrl(key: string) {
  const entry = mediaFileObjectUrlCache.get(key);

  if (entry) {
    entry.refCount += 1;
  }
}

function releaseMediaFileObjectUrl(key: string) {
  const entry = mediaFileObjectUrlCache.get(key);

  if (!entry) {
    return;
  }

  entry.refCount -= 1;

  if (entry.refCount <= 0) {
    URL.revokeObjectURL(entry.url);
    mediaFileObjectUrlCache.delete(key);
  }
}

export function useMediaFileObjectUrls(mediaFiles: MediaFile[]) {
  const entries = mediaFiles.map(getOrCreateMediaFileObjectUrlEntry);
  const entryKeys = entries.map((entry) => entry.key);
  const entryKeysKey = JSON.stringify(entryKeys);

  useEffect(() => {
    const keys = JSON.parse(entryKeysKey) as string[];

    for (const key of keys) {
      retainMediaFileObjectUrl(key);
    }

    return () => {
      for (const key of keys) {
        releaseMediaFileObjectUrl(key);
      }
    };
  }, [entryKeysKey]);

  return entries.map((entry) => entry.url);
}

export function useMediaFile(mediaFileId: string) {
  if (!isValidDocumentId(mediaFileId)) {
    throw new Error("Malformed MediaFile ID");
  }

  const [mediaFile] = useSuspenseDocument<MediaFile>(mediaFileId, {
    required: true,
  });

  const [url] = useMediaFileObjectUrls([mediaFile]);

  return {
    mediaFile,
    mediaFileId,
    url,
  };
}
