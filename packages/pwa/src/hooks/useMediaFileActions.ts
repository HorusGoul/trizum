import { t } from "@lingui/core/macro";
import { encodeBlob, type MediaFile } from "#src/models/media.ts";
import {
  ImageProcessingError,
  processImage,
  type ImageCompressionOptions,
  compressionPresets,
  isHeicImageFile,
  isSupportedImageFile,
} from "#src/lib/imageCompression.ts";
import {
  type Repo,
  RawString,
  type DocumentId,
} from "@automerge/automerge-repo";
import { useRepo } from "#src/lib/automerge/useRepo.ts";

export function useMediaFileActions() {
  const repo = useRepo();

  return getMediaFileHelpers(repo);
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
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  );
}

export function getMediaFileHelpers(repo: Repo) {
  async function createMediaFile(
    blob: Blob,
    metadata: Record<string, unknown>,
    compressionOptions?: ImageCompressionOptions,
  ) {
    let processedBlob = blob;
    let compressionMetadata = {};

    // Check if the blob is an image file or a HEIC/HEIF upload.
    if (isSupportedImageFile(blob)) {
      const file =
        blob instanceof File
          ? blob
          : new File([blob], "image", { type: blob.type });

      try {
        // Process the image with compression
        const processed = await processImage(
          file,
          compressionOptions || compressionPresets.balanced,
        );
        processedBlob = processed.blob;

        // Add compression metadata
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
        console.warn("Image compression failed, using original:", error);

        if (isHeicImageFile(file)) {
          throw error instanceof ImageProcessingError
            ? error
            : new ImageProcessingError("heic_conversion_failed", error);
        }

        // If compression fails for non-HEIC images, use the original blob
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

    const handle = repo.create<MediaFile>({
      id: "id" as DocumentId,
      type: "mediaFile",
      encodedBlob: new RawString(await encodeBlob(processedBlob)),
      metadata: omitUndefinedMetadataValues({
        ...metadata,
        ...compressionMetadata,
      }),
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
