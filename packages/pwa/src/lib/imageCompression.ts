import imageCompression from "browser-image-compression";
import { parse } from "exifr";

export interface ImageCompressionOptions {
  /** Maximum file size in MB (default: 2) */
  maxSizeMB?: number;
  /** Maximum width in pixels (default: 1920) */
  maxWidthOrHeight?: number;
  /** Image quality 0-1 (default: 0.8) */
  initialQuality?: number;
  /** Whether to always convert to JPEG (default: true) */
  alwaysKeepResolution?: boolean;
  /** Whether to use WebWorker for compression (default: false) */
  useWebWorker?: boolean;
  /** Maximum file size in MB before compression is applied (default: 5) */
  maxSizeBeforeCompress?: number;
}

export interface ProcessedImage {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  orientation?: number;
}

const DEFAULT_OPTIONS: Required<ImageCompressionOptions> = {
  maxSizeMB: 2,
  maxWidthOrHeight: 1920,
  initialQuality: 0.8,
  alwaysKeepResolution: true,
  useWebWorker: false,
  maxSizeBeforeCompress: 5,
};

type ParseResult =
  | {
      Orientation?: number;
    }
  | null
  | undefined;

/**
 * Corrects image orientation based on EXIF data and removes EXIF metadata
 */
async function correctOrientation(
  file: File,
): Promise<{ canvas: HTMLCanvasElement; mimeType: string }> {
  const img = new Image();
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not get canvas context");
  }

  return new Promise((resolve, reject) => {
    img.onload = async () => {
      try {
        // Read EXIF data to get orientation (with error handling for unsupported formats)
        let orientation = 1;
        try {
          const exif = (await parse(file)) as ParseResult;
          orientation = exif?.Orientation ?? 1;
        } catch (exifError) {
          // If EXIF parsing fails (e.g., for some WebP files), assume no rotation needed
          console.warn(
            "EXIF parsing failed, assuming no rotation needed:",
            exifError,
          );
          orientation = 1;
        }

        // Set canvas dimensions based on orientation
        if (orientation >= 5) {
          canvas.width = img.height;
          canvas.height = img.width;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }

        // Apply transformations based on orientation
        switch (orientation) {
          case 2:
            // Horizontal flip
            ctx.scale(-1, 1);
            ctx.translate(-canvas.width, 0);
            break;
          case 3:
            // 180° rotation
            ctx.translate(canvas.width, canvas.height);
            ctx.rotate(Math.PI);
            break;
          case 4:
            // Vertical flip
            ctx.scale(1, -1);
            ctx.translate(0, -canvas.height);
            break;
          case 5:
            // 90° counter-clockwise + horizontal flip
            ctx.translate(canvas.height, 0);
            ctx.rotate(Math.PI / 2);
            ctx.scale(-1, 1);
            break;
          case 6:
            // 90° clockwise
            ctx.translate(canvas.width, 0);
            ctx.rotate(Math.PI / 2);
            break;
          case 7:
            // 90° clockwise + horizontal flip
            ctx.translate(canvas.height, canvas.width);
            ctx.rotate(Math.PI / 2);
            ctx.scale(-1, 1);
            break;
          case 8:
            // 90° counter-clockwise
            ctx.translate(0, canvas.height);
            ctx.rotate(-Math.PI / 2);
            break;
          default:
            // No transformation needed
            break;
        }

        // Draw the image
        ctx.drawImage(img, 0, 0);

        // Determine the best output format
        const mimeType = getBestMimeType(file.type);

        resolve({ canvas, mimeType });
      } catch (error) {
        if (error instanceof Error) {
          reject(error);
        } else {
          reject(new Error("Unknown error while correcting orientation"));
        }
      }
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Determines the best MIME type for output based on input type and browser support
 */
function getBestMimeType(inputType: string): string {
  // If input is WebP and browser supports it, keep WebP
  if (inputType === "image/webp" && supportsImageFormat("image/webp")) {
    return "image/webp";
  }

  // If input is PNG and browser supports it, keep PNG for transparency support
  if (inputType === "image/png" && supportsImageFormat("image/png")) {
    return "image/png";
  }

  // If input is GIF and browser supports it, keep GIF for animation support
  if (inputType === "image/gif" && supportsImageFormat("image/gif")) {
    return "image/gif";
  }

  // Default to JPEG for everything else (JPEG, BMP, etc.)
  return "image/jpeg";
}

/**
 * Checks if the browser supports a specific image format
 */
function supportsImageFormat(mimeType: string): boolean {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) return false;

  // Test if the browser can convert to this format
  try {
    canvas.toBlob(() => {}, mimeType, 0.9);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely converts canvas to blob with fallback for unsupported formats
 */
async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number = 0.9,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          // Fallback to JPEG if the requested format fails
          if (mimeType !== "image/jpeg") {
            console.warn(
              `Failed to convert to ${mimeType}, falling back to JPEG`,
            );
            canvas.toBlob(
              (fallbackBlob) => {
                if (fallbackBlob) {
                  resolve(fallbackBlob);
                } else {
                  reject(new Error("Failed to convert canvas to blob"));
                }
              },
              "image/jpeg",
              quality,
            );
          } else {
            reject(new Error("Failed to convert canvas to blob"));
          }
        }
      },
      mimeType,
      quality,
    );
  });
}

/**
 * Processes an image file: corrects orientation (removes EXIF data in the process) and compresses
 */
export async function processImage(
  file: File,
  options: ImageCompressionOptions = {},
): Promise<ProcessedImage> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = file.size;

  // If it's not an image file, return it as-is
  if (!file.type.startsWith("image/")) {
    return {
      blob: file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
    };
  }

  try {
    // First, correct orientation and remove EXIF data
    const { canvas: correctedCanvas, mimeType } =
      await correctOrientation(file);

    // Convert canvas to blob (this removes EXIF data)
    const correctedBlob = await canvasToBlob(correctedCanvas, mimeType, 0.9);

    // Check if compression is needed
    const needsCompression =
      originalSize > opts.maxSizeBeforeCompress * 1024 * 1024;

    let finalBlob: Blob;
    let compressedSize: number;

    if (needsCompression) {
      // Convert blob to file for compression
      const correctedFile = new File([correctedBlob], file.name, {
        type: mimeType,
        lastModified: file.lastModified,
      });

      // Compress the image
      const compressedFile = await imageCompression(correctedFile, {
        maxSizeMB: opts.maxSizeMB,
        maxWidthOrHeight: opts.maxWidthOrHeight,
        initialQuality: opts.initialQuality,
        alwaysKeepResolution: opts.alwaysKeepResolution,
        useWebWorker: opts.useWebWorker,
      });

      finalBlob = compressedFile;
      compressedSize = compressedFile.size;
    } else {
      finalBlob = correctedBlob;
      compressedSize = correctedBlob.size;
    }

    // Read orientation for metadata (with error handling)
    let orientation: number | undefined;
    try {
      const exif = (await parse(file)) as ParseResult;
      orientation = exif?.Orientation;
    } catch (exifError) {
      // If EXIF parsing fails, orientation will be undefined
      console.warn("EXIF parsing failed for metadata:", exifError);
    }

    return {
      blob: finalBlob,
      originalSize,
      compressedSize,
      compressionRatio: originalSize / compressedSize,
      orientation,
    };
  } catch (error) {
    console.error("Image processing failed:", error);
    throw new Error(
      `Failed to process image: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Creates a configuration object for different use cases
 */
export const compressionPresets = {
  /** High quality, larger file size */
  high: {
    maxSizeMB: 5,
    maxWidthOrHeight: 2560,
    initialQuality: 0.9,
    maxSizeBeforeCompress: 10,
  } as ImageCompressionOptions,

  /** Balanced quality and file size (default) */
  balanced: {
    maxSizeMB: 2,
    maxWidthOrHeight: 1920,
    initialQuality: 0.8,
    maxSizeBeforeCompress: 5,
  } as ImageCompressionOptions,

  /** High compression, smaller file size */
  compressed: {
    maxSizeMB: 1,
    maxWidthOrHeight: 1280,
    initialQuality: 0.6,
    maxSizeBeforeCompress: 3,
  } as ImageCompressionOptions,

  /** Maximum compression for very small file sizes */
  maximum: {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 800,
    initialQuality: 0.4,
    maxSizeBeforeCompress: 1,
  } as ImageCompressionOptions,
} as const;

/**
 * Convenience function to process an image with a specific preset
 */
export async function processImageWithPreset(
  file: File,
  preset: keyof typeof compressionPresets = "balanced",
): Promise<ProcessedImage> {
  return processImage(file, compressionPresets[preset]);
}

/**
 * Convenience function to process an image with custom settings
 */
export async function processImageWithCustomSettings(
  file: File,
  maxSizeMB: number = 2,
  maxWidthOrHeight: number = 1920,
  quality: number = 0.8,
): Promise<ProcessedImage> {
  return processImage(file, {
    maxSizeMB,
    maxWidthOrHeight,
    initialQuality: quality,
    maxSizeBeforeCompress: maxSizeMB * 2.5, // Compress if 2.5x larger than target
  });
}
