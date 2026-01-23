/**
 * MediaFile model for storing binary attachments like receipt photos.
 */

import type { DocumentId } from "../types.js";
import type { ImmutableString } from "../utils/immutable-string.js";

/**
 * A media file document that stores binary data (e.g., images).
 */
export interface MediaFile {
  /** Document ID (self-referential) */
  id: DocumentId;
  /** Document type discriminator */
  type: "mediaFile";
  /** Base64-encoded binary content stored as immutable string */
  encodedBlob: ImmutableString;
  /** Additional metadata about the file */
  metadata: Record<string, unknown>;
}

/**
 * Encode a Blob to a base64 string for storage in a document.
 */
export async function encodeBlob(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Use a more efficient encoding method that doesn't spread large arrays
  let binaryString = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binaryString += String.fromCharCode(uint8Array[i]);
  }

  return btoa(binaryString);
}

/**
 * Decode a base64 string back to a Blob.
 */
export function decodeBlob(encodedBlob: string): Blob {
  const encodedBlobString = atob(encodedBlob);

  const uint8Array = new Uint8Array(encodedBlobString.length);
  for (let i = 0; i < encodedBlobString.length; i++) {
    uint8Array[i] = encodedBlobString.charCodeAt(i);
  }

  return new Blob([uint8Array]);
}
