import type { LogRecord } from "@trizum/logging";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { processImage, ImageProcessingError } from "./imageCompression.ts";
import { configurePwaLogging, getLogger } from "./log.ts";

afterEach(() => {
  configurePwaLogging({ reset: true });
  vi.unstubAllGlobals();
});

it("does not allocate a blob URL when canvas is unavailable", async () => {
  const createObjectURL = vi.fn<typeof URL.createObjectURL>();
  vi.stubGlobal("URL", { createObjectURL });
  vi.stubGlobal("Image", class {});
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => null }) });

  await expect(
    processImage(new File(["image"], "receipt.jpg", { type: "image/jpeg" })),
  ).rejects.toMatchObject({
    code: "image_processing_failed",
    cause: new Error("Could not get canvas context"),
    diagnostics: { processingStage: "decode_and_orient" },
  });
  expect(createObjectURL).not.toHaveBeenCalled();
});

it("warns during processing and reports failed uploads without file contents or names", async () => {
  const records: LogRecord[] = [];
  configurePwaLogging({
    reset: true,
    extraSinks: { capture: (record) => records.push(record) },
    surfaceSinks: ["capture"],
  });
  vi.stubGlobal(
    "Image",
    class {
      onerror?: () => void;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    },
  );
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({}) }) });
  vi.stubGlobal("URL", {
    createObjectURL: () => "blob:private",
    revokeObjectURL: vi.fn<typeof URL.revokeObjectURL>(),
  });
  const file = new File(["private-image-bytes"], "private-receipt.jpg", { type: "image/jpeg" });
  let error: ImageProcessingError | undefined;

  try {
    await processImage(file);
  } catch (cause) {
    if (!(cause instanceof ImageProcessingError)) throw cause;
    error = cause;
  }

  expect(error).toBeInstanceOf(ImageProcessingError);
  // Every processing failure warns; only a failed upload emits an error.
  expect(records.filter((record) => record.level === "error")).toHaveLength(0);

  const warnings = records.filter(
    (record) => record.level === "warning" && record.message[0] === "Image processing failed",
  );

  expect(warnings).toHaveLength(1);
  expect(warnings[0].properties).toMatchObject({
    processingStage: "decode_and_orient",
    imageMimeType: "image/jpeg",
    imageSizeBytes: file.size,
    isHeic: false,
    error: { name: "ImageProcessingError", cause: { message: "Failed to load image" } },
  });
  getLogger("components", "ExpenseEditor").error("Failed to upload expense attachment", {
    error,
    ...(error instanceof ImageProcessingError ? error.diagnostics : undefined),
  });
  const failures = records.filter((record) => record.level === "error");
  expect(failures).toHaveLength(1);
  expect(failures[0].properties).toMatchObject({
    processingStage: "decode_and_orient",
    imageMimeType: "image/jpeg",
    imageSizeBytes: file.size,
    isHeic: false,
    error: {
      name: "ImageProcessingError",
      message: "Image processing failed during decode_and_orient",
      cause: { message: "Failed to load image" },
    },
  });
  expect(JSON.stringify(records)).not.toContain(file.name);
  expect(JSON.stringify(records)).not.toContain("private-image-bytes");
  expect(JSON.stringify(records)).not.toContain("blob:private");
});

it("keeps a stable error title when the underlying exception has accessors", () => {
  const getter = vi.fn<() => never>(() => {
    throw new Error("Do not invoke diagnostic getters");
  });

  const cause = new Error();
  Object.defineProperties(cause, {
    name: { get: getter },
    message: { get: getter },
  });

  const diagnostics = {
    processingStage: "normalize" as const,
    imageMimeType: "image/heic",
    imageSizeBytes: 123,
    isHeic: true,
  };

  const records: LogRecord[] = [];
  configurePwaLogging({
    reset: true,
    extraSinks: { capture: (record) => records.push(record) },
    surfaceSinks: ["capture"],
  });
  const error = new ImageProcessingError("heic_conversion_failed", cause, diagnostics);
  getLogger("components", "ExpenseEditor").error("Failed to upload expense attachment", {
    error,
    ...(error instanceof ImageProcessingError ? error.diagnostics : undefined),
  });
  expect(records[0].properties).toMatchObject({
    ...diagnostics,
    error: { name: "ImageProcessingError", message: "Image processing failed during normalize" },
  });
  expect(getter).not.toHaveBeenCalled();
});
