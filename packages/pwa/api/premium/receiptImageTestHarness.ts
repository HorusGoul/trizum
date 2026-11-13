import { vi } from "vite-plus/test";
import { Buffer } from "node:buffer";
import type { ReceiptImages } from "./receiptImage";

/** External Images binding fixture; real codec coverage lives in receiptImage.test.ts. */
export function createReceiptImageTestHarness() {
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0x01]);

  const info = vi.fn<ReceiptImages["info"]>().mockResolvedValue({
    format: "image/jpeg",
    width: 100,
    height: 200,
    fileSize: bytes.length,
  });

  const output = vi.fn<ImageTransformer["output"]>().mockImplementation(async () => ({
    image: () => new Blob([bytes]).stream(),
    response: () => new Response(bytes),
    contentType: () => "image/jpeg",
  }));

  const transformer: ImageTransformer = {
    transform: () => transformer,
    draw: () => transformer,
    output,
  };

  const input = vi.fn<ReceiptImages["input"]>(() => transformer);

  return {
    images: { info, input },
    info,
    input,
    output,
    preparedImage: `data:image/jpeg;base64,${bytes.toString("base64")}`,
  };
}
