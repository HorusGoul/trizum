import { useEffect } from "react";
import { decodeBlob } from "#src/models/media.ts";
import type { MediaFile } from "#src/models/media.ts";

type MediaContent = Pick<MediaFile, "metadata" | "encodedBlob">;

interface MediaFileObjectUrlEntry {
  key: string;
  refCount: number;
  url: string;
}

const mediaFileObjectUrlCache = new Map<string, MediaFileObjectUrlEntry>();

function getMediaFileMimeType(mediaFile: MediaContent) {
  return mediaFile.metadata.mimeType;
}

function getMediaFileObjectUrlKey(mediaFile: MediaContent) {
  return `${getMediaFileMimeType(mediaFile) ?? ""}\0${mediaFile.encodedBlob.val}`;
}

function getOrCreateMediaFileObjectUrlEntry(mediaFile: MediaContent) {
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
    // Let replacement consumers retain a shared URL before revoking it.
    queueMicrotask(() => {
      if (mediaFileObjectUrlCache.get(key) === entry && entry.refCount <= 0) {
        URL.revokeObjectURL(entry.url);
        mediaFileObjectUrlCache.delete(key);
      }
    });
  }
}

export function useMediaFileObjectUrls(mediaFiles: readonly MediaContent[]) {
  const entries = mediaFiles.map(getOrCreateMediaFileObjectUrlEntry);
  const entryKeys = entries.map((entry) => entry.key);
  const entryKeysKey = JSON.stringify(entryKeys);

  useEffect(() => {
    // SAFETY: entryKeysKey was JSON.stringify'd from the string entryKeys array in this render; it is not external JSON.
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
