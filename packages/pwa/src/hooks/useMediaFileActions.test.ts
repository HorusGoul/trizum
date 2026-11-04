import { i18n } from "@lingui/core";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { Repo, type DocHandle } from "@automerge/automerge-repo";
import { decodeBlob, type MediaFile } from "#src/models/media.ts";
import type * as imageCompressionModule from "#src/lib/imageCompression.ts";

vi.mock("#src/lib/imageCompression.ts", async () => {
  const actual = await vi.importActual<typeof imageCompressionModule>(
    "#src/lib/imageCompression.ts",
  );

  return {
    ...actual,
    processImage: vi.fn<typeof imageCompressionModule.processImage>(),
  };
});

import { getImageUploadErrorMessage, getMediaFileHelpers } from "./useMediaFileActions";
import {
  ImageProcessingError,
  type ProcessedImage,
  processImage,
} from "#src/lib/imageCompression.ts";

const testRepos: Repo[] = [];

function createMockRepo() {
  const repo = new Repo({ network: [] });
  testRepos.push(repo);
  const create = vi.spyOn(repo, "create");

  return {
    repo,
    getLastCreatedHandle() {
      const result = create.mock.results.at(-1);

      if (!result || result.type !== "return")
        throw new Error("Expected a created document handle");

      // SAFETY: This fixture observes only the MediaFile created by the helper under test.
      const handle = result.value as DocHandle<MediaFile>;

      return { documentId: handle.documentId, doc: handle.doc() };
    },
  };
}

describe("getMediaFileHelpers", () => {
  const processImageMock = vi.mocked(processImage);

  beforeEach(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  beforeEach(() => {
    processImageMock.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(async () => {
    await Promise.all(testRepos.splice(0).map((repo) => repo.shutdown()));
    vi.restoreAllMocks();
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
    const blob = decodeBlob(mediaFile.encodedBlob.val, mediaFile.metadata.mimeType as string);

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

  test("omits undefined optional metadata when storing processed images", async () => {
    const processedImage: ProcessedImage = {
      blob: new Blob(["jpeg-output"], { type: "image/jpeg" }),
      originalSize: 100,
      compressedSize: 60,
      compressionRatio: 100 / 60,
      orientation: undefined,
      outputMimeType: "image/jpeg",
      originalMimeType: undefined,
      convertedFromHeic: true,
    };

    processImageMock.mockResolvedValue(processedImage);

    const { repo, getLastCreatedHandle } = createMockRepo();
    const { createMediaFile } = getMediaFileHelpers(repo);

    const file = new File(["heic-input"], "receipt.heic", {
      type: "",
      lastModified: 789,
    });

    await expect(
      createMediaFile(file, { source: "test", cameraModel: undefined }),
    ).resolves.toBeDefined();

    const handle = getLastCreatedHandle();
    const mediaFile = handle.doc;

    expect(mediaFile.metadata).toMatchObject({
      source: "test",
      mimeType: "image/jpeg",
      originalFilename: "receipt.heic",
      lastModified: 789,
      originalSize: 100,
      compressedSize: 60,
      convertedFromHeic: true,
      processed: true,
    });
    expect(mediaFile.metadata).not.toHaveProperty("orientation");
    expect(mediaFile.metadata).not.toHaveProperty("originalMimeType");
    expect(mediaFile.metadata).not.toHaveProperty("cameraModel");
  });

  test("maps HEIC processing failures to a user-facing error", () => {
    expect(
      getImageUploadErrorMessage(new ImageProcessingError("heic_conversion_failed")),
    ).toContain("HEIC");
  });
});
