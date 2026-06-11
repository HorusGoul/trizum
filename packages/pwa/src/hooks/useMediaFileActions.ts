import { t } from "@lingui/core/macro";
import { createMediaFileInFate } from "#src/lib/data/fateAppData.ts";
import { useTrizumData } from "#src/lib/data/TrizumDataContext.ts";
import {
  ImageProcessingError,
  compressionPresets,
  isHeicImageFile,
  isSupportedImageFile,
  processImage,
  type ImageCompressionOptions,
} from "#src/lib/imageCompression.ts";
import { getLogger } from "#src/lib/log.ts";
import { encodeBlob } from "#src/models/media.ts";

const logger = getLogger("hooks", "useMediaFileActions");

export function useMediaFileActions() {
  const { client, userId } = useTrizumData();

  return getMediaFileHelpers({ client, userId });
}

export function getImageUploadErrorMessage(error: unknown): string | null {
  if (!(error instanceof ImageProcessingError)) {
    return null;
  }

  switch (error.code) {
    case "heic_conversion_failed":
      return t`This HEIC or HEIF image could not be processed. Try another photo or export it as JPEG or PNG.`;
  }
}

function omitUndefinedMetadataValues(metadata: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

export function getMediaFileHelpers({
  client,
  userId,
}: {
  client: ReturnType<typeof useTrizumData>["client"];
  userId: string;
}) {
  async function createMediaFile(
    blob: Blob,
    metadata: Record<string, unknown>,
    compressionOptions?: ImageCompressionOptions,
  ) {
    let processedBlob = blob;
    let compressionMetadata = {};

    if (isSupportedImageFile(blob)) {
      const file = blob instanceof File ? blob : new File([blob], "image", { type: blob.type });

      try {
        const processed = await processImage(
          file,
          compressionOptions || compressionPresets.balanced,
        );
        processedBlob = processed.blob;

        compressionMetadata = omitUndefinedMetadataValues({
          mimeType: processed.outputMimeType || processedBlob.type,
          originalMimeType: processed.originalMimeType,
          originalFilename: file.name,
          lastModified: file.lastModified,
          originalSize: processed.originalSize,
          compressedSize: processed.compressedSize,
          compressionRatio: processed.compressionRatio,
          orientation: processed.orientation,
          convertedFromHeic: processed.convertedFromHeic,
          processed: true,
        });
      } catch (error) {
        logger.warning("Image compression failed, using original", { error });

        if (isHeicImageFile(file)) {
          throw error instanceof ImageProcessingError
            ? error
            : new ImageProcessingError("heic_conversion_failed", error);
        }

        compressionMetadata = omitUndefinedMetadataValues({
          mimeType: file.type || blob.type,
          originalMimeType: file.type || blob.type,
          originalFilename: file.name,
          lastModified: file.lastModified,
          processed: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const mediaFile = await createMediaFileInFate(client, userId, {
      encodedBlob: await encodeBlob(processedBlob),
      metadata: omitUndefinedMetadataValues({
        ...metadata,
        ...compressionMetadata,
      }),
      partyId: typeof metadata.partyId === "string" ? metadata.partyId : undefined,
    });

    return [mediaFile.id, mediaFile] as const;
  }

  return {
    createMediaFile,
  };
}
