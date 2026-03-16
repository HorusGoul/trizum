import { describe, expect, test } from "vitest";
import { decodeBlob, encodeBlob } from "./media";

describe("media blob encoding", () => {
  test("restores the MIME type when decoding a blob", async () => {
    const encoded = await encodeBlob(
      new Blob(["image-data"], { type: "image/jpeg" }),
    );
    const decoded = decodeBlob(encoded, "image/jpeg");

    expect(decoded.type).toBe("image/jpeg");
    await expect(decoded.text()).resolves.toBe("image-data");
  });

  test("keeps backward compatibility when no MIME type is provided", async () => {
    const encoded = await encodeBlob(new Blob(["raw-data"]));
    const decoded = decodeBlob(encoded);

    expect(decoded.type).toBe("");
    await expect(decoded.text()).resolves.toBe("raw-data");
  });
});
