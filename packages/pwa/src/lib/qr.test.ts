import { generateAutomergeUrl, parseAutomergeUrl } from "@automerge/automerge-repo/slim";
import { prepareZXingModule } from "barcode-detector/ponyfill";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test, vi } from "vite-plus/test";
import { BarcodeDetector, parseQRCodeForPartyId } from "./qr";

const QR_SCANNER_TEST_VALUE = "TRIZUM QR SCANNER TEST";

const QR_SCANNER_TEST_MODULES = [
  "1111111011100001101111111",
  "1000001011001011001000001",
  "1011101000010111001011101",
  "1011101010110000001011101",
  "1011101000010100001011101",
  "1000001000100010101000001",
  "1111111010101010101111111",
  "0000000010101110000000000",
  "1011011101100110101001011",
  "0101110100011001100101111",
  "0110111100110010000101111",
  "1101010000000111101001101",
  "0000111011110001001000011",
  "0001100111110100110011010",
  "0100011010001010011011010",
  "1001110010101100101111010",
  "0000101111010001111111110",
  "0000000011001100100010110",
  "1111111010111001101010111",
  "1000001010001001100011001",
  "1011101000111100111111001",
  "1011101011101111110100001",
  "1011101011011100110000010",
  "1000001000000001011011001",
  "1111111010101011000001101",
] as const;

class TestImageData {
  constructor(
    public data: Uint8ClampedArray,
    public width: number,
    public height: number,
  ) {}
}

class TestDOMRectReadOnly {
  public readonly top: number;
  public readonly right: number;
  public readonly bottom: number;
  public readonly left: number;

  constructor(
    public readonly x = 0,
    public readonly y = 0,
    public readonly width = 0,
    public readonly height = 0,
  ) {
    this.top = y;
    this.right = x + width;
    this.bottom = y + height;
    this.left = x;
  }
}

function createQRCodeImageData(rows: readonly string[]): ImageData {
  const moduleScale = 8;
  const quietZoneModules = 4;
  const moduleCount = rows.length;
  const width = (moduleCount + quietZoneModules * 2) * moduleScale;
  const data = new Uint8ClampedArray(width * width * 4);

  data.fill(255);

  rows.forEach((row, moduleY) => {
    row.split("").forEach((module, moduleX) => {
      if (module !== "1") {
        return;
      }

      const startX = (moduleX + quietZoneModules) * moduleScale;
      const startY = (moduleY + quietZoneModules) * moduleScale;

      for (let y = startY; y < startY + moduleScale; y += 1) {
        for (let x = startX; x < startX + moduleScale; x += 1) {
          const pixel = (y * width + x) * 4;
          data[pixel] = 0;
          data[pixel + 1] = 0;
          data[pixel + 2] = 0;
        }
      }
    });
  });

  return new TestImageData(data, width, width) as ImageData;
}

describe("BarcodeDetector", () => {
  beforeAll(() => {
    vi.stubGlobal("ImageData", TestImageData);
    vi.stubGlobal("DOMRectReadOnly", TestDOMRectReadOnly);
    prepareZXingModule({
      overrides: {
        wasmBinary: new Uint8Array(
          readFileSync(fileURLToPath(new URL("../../public/zxing_reader.wasm", import.meta.url))),
        ),
      },
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  test("detects a QR code from image data", async () => {
    const detector = new BarcodeDetector({ formats: ["qr_code"] });

    await expect(detector.detect(createQRCodeImageData(QR_SCANNER_TEST_MODULES))).resolves.toEqual([
      expect.objectContaining({
        format: "qr_code",
        rawValue: QR_SCANNER_TEST_VALUE,
      }),
    ]);
  });
});

describe("parseQRCodeForPartyId", () => {
  // Generate a valid Automerge document ID for testing
  let VALID_DOCUMENT_ID: string;

  beforeAll(() => {
    const url = generateAutomergeUrl();
    VALID_DOCUMENT_ID = parseAutomergeUrl(url).documentId;
  });

  test("should return null for empty string", () => {
    expect(parseQRCodeForPartyId("")).toBeNull();
    expect(parseQRCodeForPartyId("   ")).toBeNull();
  });

  test("should return null for invalid party ID", () => {
    expect(parseQRCodeForPartyId("invalid")).toBeNull();
    expect(parseQRCodeForPartyId("123")).toBeNull();
    expect(parseQRCodeForPartyId("abc")).toBeNull();
  });

  test("should parse direct valid party ID", () => {
    expect(parseQRCodeForPartyId(VALID_DOCUMENT_ID)).toBe(VALID_DOCUMENT_ID);
  });

  test("should parse party ID with whitespace", () => {
    expect(parseQRCodeForPartyId(`  ${VALID_DOCUMENT_ID}  `)).toBe(VALID_DOCUMENT_ID);
  });

  test("should parse URL with party ID", () => {
    expect(parseQRCodeForPartyId(`https://trizum.app/party/${VALID_DOCUMENT_ID}`)).toBe(
      VALID_DOCUMENT_ID,
    );
  });

  test("should parse URL with party ID and trailing path", () => {
    expect(parseQRCodeForPartyId(`https://trizum.app/party/${VALID_DOCUMENT_ID}/expenses`)).toBe(
      VALID_DOCUMENT_ID,
    );
  });

  test("should parse URL with party ID and query params", () => {
    expect(
      parseQRCodeForPartyId(`https://trizum.app/party/${VALID_DOCUMENT_ID}?tab=expenses`),
    ).toBe(VALID_DOCUMENT_ID);
  });

  test("should parse URL with party ID and hash", () => {
    expect(parseQRCodeForPartyId(`https://trizum.app/party/${VALID_DOCUMENT_ID}#section`)).toBe(
      VALID_DOCUMENT_ID,
    );
  });

  test("should return null for URL without party path", () => {
    expect(parseQRCodeForPartyId("https://trizum.app/")).toBeNull();
    expect(parseQRCodeForPartyId("https://trizum.app/join")).toBeNull();
  });

  test("should return null for URL with invalid party ID", () => {
    expect(parseQRCodeForPartyId("https://trizum.app/party/invalid")).toBeNull();
    expect(parseQRCodeForPartyId("https://trizum.app/party/")).toBeNull();
  });
});
