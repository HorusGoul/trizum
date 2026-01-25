import { describe, test, expect, beforeAll } from "vitest";
import { parseQRCodeForPartyId } from "./qr";
import { generateTestDocumentId } from "@trizum/sdk/testing";

describe("parseQRCodeForPartyId", () => {
  // Generate a valid document ID for testing
  let VALID_DOCUMENT_ID: string;

  beforeAll(() => {
    VALID_DOCUMENT_ID = generateTestDocumentId();
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
    expect(parseQRCodeForPartyId(`  ${VALID_DOCUMENT_ID}  `)).toBe(
      VALID_DOCUMENT_ID,
    );
  });

  test("should parse URL with party ID", () => {
    expect(
      parseQRCodeForPartyId(`https://trizum.app/party/${VALID_DOCUMENT_ID}`),
    ).toBe(VALID_DOCUMENT_ID);
  });

  test("should parse URL with party ID and trailing path", () => {
    expect(
      parseQRCodeForPartyId(
        `https://trizum.app/party/${VALID_DOCUMENT_ID}/expenses`,
      ),
    ).toBe(VALID_DOCUMENT_ID);
  });

  test("should parse URL with party ID and query params", () => {
    expect(
      parseQRCodeForPartyId(
        `https://trizum.app/party/${VALID_DOCUMENT_ID}?tab=expenses`,
      ),
    ).toBe(VALID_DOCUMENT_ID);
  });

  test("should parse URL with party ID and hash", () => {
    expect(
      parseQRCodeForPartyId(
        `https://trizum.app/party/${VALID_DOCUMENT_ID}#section`,
      ),
    ).toBe(VALID_DOCUMENT_ID);
  });

  test("should return null for URL without party path", () => {
    expect(parseQRCodeForPartyId("https://trizum.app/")).toBeNull();
    expect(parseQRCodeForPartyId("https://trizum.app/join")).toBeNull();
  });

  test("should return null for URL with invalid party ID", () => {
    expect(
      parseQRCodeForPartyId("https://trizum.app/party/invalid"),
    ).toBeNull();
    expect(parseQRCodeForPartyId("https://trizum.app/party/")).toBeNull();
  });
});
