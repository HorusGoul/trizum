import { afterEach, expect, it, vi } from "vite-plus/test";
import { processImage } from "./imageCompression.ts";

vi.mock("exifr", () => ({
  parse: vi.fn<(file: File) => Promise<undefined>>().mockResolvedValue(undefined),
}));

afterEach(() => vi.unstubAllGlobals());

it("does not allocate a blob URL when canvas is unavailable", async () => {
  const createObjectURL = vi.fn<typeof URL.createObjectURL>();
  vi.stubGlobal("URL", { createObjectURL });
  vi.stubGlobal("Image", class {});
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => null }) });

  await expect(
    processImage(new File(["image"], "receipt.jpg", { type: "image/jpeg" })),
  ).rejects.toThrow("Could not get canvas context");
  expect(createObjectURL).not.toHaveBeenCalled();
});
