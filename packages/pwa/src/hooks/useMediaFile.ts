import { view } from "@nkzw/fate";
import type { MediaEntity } from "#src/lib/data/entities.ts";
import { useFateClient } from "react-fate";
import { useRequiredView } from "#src/lib/data/hooks.ts";
import { decodeBlob, type MediaFile } from "#src/models/media.ts";
import { isValidRecordId } from "#src/lib/data/ids.ts";
import { useEffect } from "react";

const MediaContentView = view<MediaEntity>()({
  id: true,
  available: true,
  type: true,
  encodedBlob: true,
  metadata: true,
});

interface MediaFileObjectUrlEntry {
  key: string;
  refCount: number;
  url: string;
}

const mediaFileObjectUrlCache = new Map<string, MediaFileObjectUrlEntry>();

function getMediaFileMimeType(mediaFile: MediaFile) {
  return mediaFile.metadata.mimeType;
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
    // Let replacement consumers retain a shared URL before revoking it.
    queueMicrotask(() => {
      if (mediaFileObjectUrlCache.get(key) === entry && entry.refCount <= 0) {
        URL.revokeObjectURL(entry.url);
        mediaFileObjectUrlCache.delete(key);
      }
    });
  }
}

export function useMediaFileObjectUrls(mediaFiles: readonly MediaFile[]) {
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

export function useMediaFile(mediaFileId: string) {
  if (!isValidRecordId(mediaFileId)) {
    throw new Error("Malformed MediaFile ID");
  }

  const client = useFateClient();

  const mediaFile = useRequiredView(
    MediaContentView,
    client.ref<MediaEntity>("Media", mediaFileId, MediaContentView),
  );

  const [url] = useMediaFileObjectUrls([mediaFile]);

  return {
    mediaFile,
    mediaFileId,
    url,
  };
}
