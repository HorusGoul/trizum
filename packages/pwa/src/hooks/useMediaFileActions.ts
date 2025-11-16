import { encodeBlob, type MediaFile } from "#src/models/media.ts";
import {
  processImage,
  type ImageCompressionOptions,
  compressionPresets,
} from "#src/lib/imageCompression.ts";
import { RawString, type DocumentId } from "@automerge/automerge-repo";
import { useRepo } from "#src/lib/automerge/useRepo.ts";

export function useMediaFileActions() {
  const repo = useRepo();

  async function createMediaFile(
    blob: Blob,
    metadata: Record<string, unknown>,
    compressionOptions?: ImageCompressionOptions,
  ) {
    let processedBlob = blob;
    let compressionMetadata = {};

    // Check if the blob is an image file
    if (blob.type.startsWith("image/")) {
      try {
        // Convert blob to file for processing
        const file = new File([blob], "image", { type: blob.type });

        // Process the image with compression
        const processed = await processImage(
          file,
          compressionOptions || compressionPresets.balanced,
        );
        processedBlob = processed.blob;

        // Add compression metadata
        compressionMetadata = {
          originalSize: processed.originalSize,
          compressedSize: processed.compressedSize,
          compressionRatio: processed.compressionRatio,
          processed: true,
        };
      } catch (error) {
        console.warn("Image compression failed, using original:", error);
        // If compression fails, use the original blob
        compressionMetadata = {
          processed: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    const handle = repo.create<MediaFile>({
      id: "id" as DocumentId,
      type: "mediaFile",
      encodedBlob: new RawString(await encodeBlob(processedBlob)),
      metadata: {
        ...metadata,
        ...compressionMetadata,
      },
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
