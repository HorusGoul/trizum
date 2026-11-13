import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import { Buffer } from "node:buffer";
import { deflateSync } from "node:zlib";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";
import { MAX_RECEIPT_ANALYSIS_BYTES, prepareReceiptImage } from "./receiptImage";
import { createReceiptImageTestHarness } from "./receiptImageTestHarness";

let platform: Awaited<ReturnType<typeof getPlatformProxy<{ IMAGES: ImagesBinding }>>>;
let directory: string;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "trizum-receipt-image-"));
  const configPath = join(directory, "wrangler.json");
  await writeFile(
    configPath,
    JSON.stringify({
      name: "receipt-image-test",
      compatibility_date: "2025-11-18",
      images: { binding: "IMAGES" },
    }),
  );
  platform = await getPlatformProxy({
    configPath,
    envFiles: [],
    persist: false,
    remoteBindings: false,
  });
}, 30_000);

afterAll(async () => {
  await platform?.dispose();

  if (directory) await rm(directory, { recursive: true, force: true });
});

// A valid, highly compressible grayscale PNG exercises pixel limits independently of bytes.
function png(width: number, height: number) {
  function chunk(type: string, data: Buffer) {
    const content = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;

    for (const byte of content) {
      crc ^= byte;

      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }

    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);

    return Buffer.concat([length, content, checksum]);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  const pixels = Buffer.alloc((width + 1) * height, 255);

  for (let row = 0; row < height; row++) pixels[row * (width + 1)] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

test.each([
  [4096, 4096],
  [600, 6000],
  [32, 64],
])(
  "normalizes a real %sx%s image without cropping or upscaling",
  async (width, height) => {
    const original = png(width, height);
    expect(original.length).toBeLessThan(1024 * 1024);

    const result = await prepareReceiptImage(
      `data:image/png;base64,${original.toString("base64")}`,
      platform.env.IMAGES,
    );

    const bytes = Buffer.from(result.slice(result.indexOf(",") + 1), "base64");
    const info = await platform.env.IMAGES.info(new Blob([bytes]).stream());
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
    expect(bytes.length).toBeLessThanOrEqual(MAX_RECEIPT_ANALYSIS_BYTES);
    expect(info.format).toBe("image/jpeg");

    if (!("width" in info)) throw new Error("Expected raster image");
    const targetEdge = Math.min(3072, Math.max(width, height));
    expect(Math.max(info.width, info.height)).toBeLessThanOrEqual(targetEdge);
    // The codec can round the shorter side, then preserve the aspect ratio.
    expect(Math.max(info.width, info.height)).toBeGreaterThanOrEqual(targetEdge - 10);
    expect(Math.abs(info.width / info.height - width / height)).toBeLessThan(0.01);
    expect(info.width * info.height).toBeLessThan(16_000_000);
  },
  15_000,
);

test("retries an oversized encoding from the original source with a bounded smaller output", async () => {
  const fixture = createReceiptImageTestHarness();
  const oversized = new Uint8Array(MAX_RECEIPT_ANALYSIS_BYTES + 1);
  fixture.output.mockResolvedValueOnce({
    image: () => new Blob([oversized]).stream(),
    response: () => new Response(oversized),
    contentType: () => "image/jpeg",
  });
  await expect(
    prepareReceiptImage("data:image/jpeg;base64,/9j/AA==", fixture.images),
  ).resolves.toBe(fixture.preparedImage);
  expect(fixture.input).toHaveBeenCalledTimes(2);
  expect(fixture.output).toHaveBeenNthCalledWith(2, expect.objectContaining({ quality: 80 }));
});

test("rejects output that remains too large after both attempts", async () => {
  const fixture = createReceiptImageTestHarness();
  fixture.output.mockImplementation(async () => ({
    image: () => new Blob([new Uint8Array(MAX_RECEIPT_ANALYSIS_BYTES + 1)]).stream(),
    response: () => new Response(),
    contentType: () => "image/jpeg",
  }));
  await expect(
    prepareReceiptImage("data:image/jpeg;base64,/9j/AA==", fixture.images),
  ).rejects.toThrow("Prepared receipt image is too large.");
  expect(fixture.input).toHaveBeenCalledTimes(2);
});

test("rejects invalid or excessive source dimensions before transforming", async () => {
  const fixture = createReceiptImageTestHarness();
  fixture.info.mockResolvedValueOnce({ format: "image/svg+xml" });
  await expect(
    prepareReceiptImage("data:image/jpeg;base64,/9j/AA==", fixture.images),
  ).rejects.toThrow("Invalid receipt image dimensions.");
  fixture.info.mockResolvedValueOnce({
    format: "image/jpeg",
    width: 20_000,
    height: 20_000,
    fileSize: 4,
  });
  await expect(
    prepareReceiptImage("data:image/jpeg;base64,/9j/AA==", fixture.images),
  ).rejects.toThrow("Receipt image dimensions are too large.");
  expect(fixture.input).not.toHaveBeenCalled();
});

test("checks prepared dimensions before passing bytes to a model", async () => {
  const fixture = createReceiptImageTestHarness();
  fixture.info
    .mockResolvedValueOnce({ format: "image/jpeg", width: 100, height: 200, fileSize: 4 })
    .mockResolvedValueOnce({ format: "image/jpeg", width: 5000, height: 5000, fileSize: 4 });
  await expect(
    prepareReceiptImage("data:image/jpeg;base64,/9j/AA==", fixture.images),
  ).rejects.toThrow("Invalid prepared receipt image.");
});

test("times out image preparation and prevents a late source read from starting a transform", async () => {
  vi.useFakeTimers();

  try {
    const fixture = createReceiptImageTestHarness();
    let resolve!: (info: ImageInfoResponse) => void;
    fixture.info.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const pending = prepareReceiptImage("data:image/jpeg;base64,/9j/AA==", fixture.images);
    await Promise.all([
      expect(pending).rejects.toThrow("Receipt image preparation timed out."),
      vi.advanceTimersByTimeAsync(5_000),
    ]);
    resolve({ format: "image/jpeg", width: 100, height: 200, fileSize: 4 });
    await vi.advanceTimersByTimeAsync(0);
    expect(fixture.input).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
