import { i18n } from "@lingui/core";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Repo } from "@automerge/automerge-repo";
import { decodeBlob, type MediaFile } from "#src/models/media.ts";

vi.mock("#src/lib/imageCompression.ts", async () => {
  const actual = await vi.importActual("#src/lib/imageCompression.ts");

  return {
    ...actual,
    processImage: vi.fn(),
  };
});

import {
  getImageUploadErrorMessage,
  getMediaFileHelpers,
} from "./useMediaFileActions";
import {
  ImageProcessingError,
  type ProcessedImage,
  processImage,
} from "#src/lib/imageCompression.ts";

function createMockRepo() {
  let nextId = 0;
  let lastCreatedHandle:
    | {
        doc: MediaFile;
        documentId: string;
        change: (changeFn: (nextDoc: MediaFile) => void) => void;
      }
    | undefined;

  return {
    repo: {
      create<T>(doc: T) {
        const handle = {
          doc,
          documentId: `mock-doc-${++nextId}`,
          change(changeFn: (nextDoc: T) => void) {
            changeFn(handle.doc);
          },
        };
        lastCreatedHandle = handle as unknown as typeof lastCreatedHandle;

        return handle;
      },
    } as unknown as Repo,
    getLastCreatedHandle: () => {
      if (!lastCreatedHandle) {
        throw new Error("Expected a created media file handle");
      }

      return lastCreatedHandle;
    },
  };
}

describe("getMediaFileHelpers", () => {
  const processImageMock = vi.mocked(processImage);
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  beforeEach(() => {
    processImageMock.mockReset();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test("rethrows HEIC processing failures instead of storing the original blob", async () => {
    processImageMock.mockRejectedValue(new Error("decode failed"));

    const { repo } = createMockRepo();
    const { createMediaFile } = getMediaFileHelpers(repo);

    const file = new File(["heic"], "receipt.heic", {
      type: "",
      lastModified: 123,
    });

    await expect(createMediaFile(file, {})).rejects.toMatchObject({
      code: "heic_conversion_failed",
      name: "ImageProcessingError",
    });
  });

  test("falls back to the original blob for non-HEIC image failures and keeps MIME metadata", async () => {
    processImageMock.mockRejectedValue(new Error("canvas failed"));

    const { repo, getLastCreatedHandle } = createMockRepo();
    const { createMediaFile } = getMediaFileHelpers(repo);

    const file = new File(["jpeg-data"], "receipt.jpg", {
      type: "image/jpeg",
      lastModified: 456,
    });

    await createMediaFile(file, { source: "test" });
    const handle = getLastCreatedHandle();
    const mediaFile = handle.doc;
    const blob = decodeBlob(
      mediaFile.encodedBlob.val,
      mediaFile.metadata.mimeType as string,
    );

    expect(mediaFile.id).toBe(handle.documentId);
    expect(mediaFile.metadata).toMatchObject({
      source: "test",
      mimeType: "image/jpeg",
      originalMimeType: "image/jpeg",
      originalFilename: "receipt.jpg",
      lastModified: 456,
      processed: false,
      error: "canvas failed",
    });
    expect(blob.type).toBe("image/jpeg");
    await expect(blob.text()).resolves.toBe("jpeg-data");
  });

  test("stores the processed MIME type when image processing succeeds", async () => {
    const processedImage: ProcessedImage = {
      blob: new Blob(["jpeg-output"], { type: "image/jpeg" }),
      originalSize: 100,
      compressedSize: 60,
      compressionRatio: 100 / 60,
      orientation: 6,
      outputMimeType: "image/jpeg",
      originalMimeType: "image/heic",
      convertedFromHeic: true,
    };
    processImageMock.mockResolvedValue(processedImage);

    const { repo, getLastCreatedHandle } = createMockRepo();
    const { createMediaFile } = getMediaFileHelpers(repo);

    const file = new File(["heic-input"], "receipt.heic", {
      type: "image/heic",
      lastModified: 789,
    });

    await createMediaFile(file, { source: "test" });
    const handle = getLastCreatedHandle();
    const mediaFile = handle.doc;

    expect(mediaFile.metadata).toMatchObject({
      source: "test",
      mimeType: "image/jpeg",
      originalMimeType: "image/heic",
      originalFilename: "receipt.heic",
      lastModified: 789,
      originalSize: 100,
      compressedSize: 60,
      orientation: 6,
      convertedFromHeic: true,
      processed: true,
    });
  });

  test("maps HEIC processing failures to a user-facing error", () => {
    expect(
      getImageUploadErrorMessage(
        new ImageProcessingError("heic_conversion_failed"),
      ),
    ).toContain("HEIC");
  });
});
