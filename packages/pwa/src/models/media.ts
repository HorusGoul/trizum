import type { DocumentId, RawString } from "@automerge/automerge-repo/slim";

export interface MediaFile {
  id: DocumentId;
  type: "mediaFile";
  encodedBlob: RawString;
  metadata: Record<string, unknown>;
}

export async function encodeBlob(blob: Blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Use a more efficient encoding method that doesn't spread large arrays
  let binaryString = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binaryString += String.fromCharCode(uint8Array[i]);
  }

  return btoa(binaryString);
}

export function decodeBlob(encodedBlob: string) {
  const encodedBlobString = atob(encodedBlob);

  const uint8Array = new Uint8Array(encodedBlobString.length);
  for (let i = 0; i < encodedBlobString.length; i++) {
    uint8Array[i] = encodedBlobString.charCodeAt(i);
  }

  return new Blob([uint8Array]);
}
