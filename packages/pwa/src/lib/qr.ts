import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import { BarcodeDetector, prepareZXingModule } from "barcode-detector/ponyfill";

// Configure zxing-wasm to use local WASM file instead of CDN
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) => {
      if (path.endsWith(".wasm")) {
        return `/zxing_reader.wasm`;
      }
      return prefix + path;
    },
  },
});

// Re-export configured BarcodeDetector
export { BarcodeDetector };

/**
 * Parses a QR code value to extract a party ID.
 *
 * Handles:
 * - Direct party IDs (e.g., "abc123def456...")
 * - Full URLs (e.g., "https://trizum.app/party/abc123def456...")
 *
 * @param value - The raw string value from the QR code
 * @returns The party ID if valid, or null if invalid
 */
export function parseQRCodeForPartyId(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  // Check if it's a URL containing /party/
  const isUrl = trimmed.includes("/");

  let partyId: string;

  if (isUrl) {
    // Extract party ID from URL like https://trizum.app/party/DOCUMENT_ID
    const partyPathMatch = trimmed.split("/party/")[1];
    if (!partyPathMatch) {
      return null;
    }
    // Take only the ID part (before any query params or additional path segments)
    partyId = partyPathMatch.split("/")[0].split("?")[0].split("#")[0];
  } else {
    // Assume the entire value is the party ID
    partyId = trimmed;
  }

  // Validate the extracted party ID
  if (!isValidDocumentId(partyId)) {
    return null;
  }

  return partyId;
}
