import { Buffer } from "node:buffer";

export type ReceiptImages = Pick<ImagesBinding, "info" | "input">;

export const MAX_RECEIPT_ANALYSIS_BYTES = 4 * 1024 * 1024;
const MAX_ANALYSIS_EDGE = 3072;

function dimensions(info: ImageInfoResponse) {
  if (
    !("width" in info) ||
    !Number.isSafeInteger(info.width) ||
    !Number.isSafeInteger(info.height) ||
    info.width <= 0 ||
    info.height <= 0
  )
    throw new Error("Invalid receipt image dimensions.");

  return info;
}

async function readOutput(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) break;
      size += value.byteLength;

      if (size > MAX_RECEIPT_ANALYSIS_BYTES) {
        await reader.cancel();

        return null;
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, size);
}

/** Prepare one private, bounded analysis image shared by extraction and verification. */
export async function prepareReceiptImage(image: string, images: ReceiptImages) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error("Receipt image preparation timed out."));
    }, 5_000);
  });

  try {
    return await Promise.race([resizeReceiptImage(image, images, controller.signal), deadline]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function resizeReceiptImage(image: string, images: ReceiptImages, signal: AbortSignal) {
  const bytes = Buffer.from(image.slice(image.indexOf(",") + 1), "base64");
  const source = dimensions(await images.info(new Blob([bytes]).stream()));
  signal.throwIfAborted();

  if (
    source.width > 12_000 ||
    source.height > 12_000 ||
    source.width * source.height > 100_000_000
  ) {
    throw new Error("Receipt image dimensions are too large.");
  }

  for (const { edge, quality } of [
    { edge: MAX_ANALYSIS_EDGE, quality: 85 },
    { edge: 2048, quality: 80 },
  ]) {
    signal.throwIfAborted();
    const scale = Math.min(1, edge / Math.max(source.width, source.height));
    const width = Math.max(1, Math.floor(source.width * scale));
    const height = Math.max(1, Math.floor(source.height * scale));

    const output = await images
      .input(new Blob([bytes]).stream())
      .transform({ width, height, fit: "scale-down" })
      .output({ format: "image/jpeg", quality, background: "#ffffff", anim: false });

    signal.throwIfAborted();
    const resized = await readOutput(output.image());
    signal.throwIfAborted();

    if (resized === null) continue;
    const info = dimensions(await images.info(new Blob([resized]).stream()));
    signal.throwIfAborted();

    if (
      info.format !== "image/jpeg" ||
      info.width > edge ||
      info.height > edge ||
      resized.length === 0
    ) {
      throw new Error("Invalid prepared receipt image.");
    }

    return `data:image/jpeg;base64,${resized.toString("base64")}`;
  }

  throw new Error("Prepared receipt image is too large.");
}
