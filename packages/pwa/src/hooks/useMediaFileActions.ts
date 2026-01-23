import { encodeBlob, type MediaFile } from "#src/models/media.ts";
import {
  processImage,
  type ImageCompressionOptions,
  compressionPresets,
} from "#src/lib/imageCompression.ts";
import {
  type TrizumClient,
  ImmutableString,
  useTrizumClient,
} from "@trizum/sdk";

export function useMediaFileActions() {
  const client = useTrizumClient();

  return getMediaFileHelpers(client);
}

export function getMediaFileHelpers(client: TrizumClient) {
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

    const { id, handle } = client.create<MediaFile>({
      type: "mediaFile",
      encodedBlob: new ImmutableString(await encodeBlob(processedBlob)),
      metadata: {
        ...metadata,
        ...compressionMetadata,
      },
    });

    return [id, handle] as const;
  }

  return {
    createMediaFile,
  };
}
