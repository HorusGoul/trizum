/**
 * Internal Automerge utilities.
 *
 * This module contains all direct Automerge access and is NOT exported publicly.
 * All Automerge types and functions should be imported from here within the SDK.
 */

import {
  Repo,
  isValidDocumentId as amIsValidDocumentId,
  type NetworkAdapterInterface,
} from "@automerge/automerge-repo";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import type {
  DocumentId as AMDocumentId,
  AnyDocumentId as AMAnyDocumentId,
  Doc as AMDoc,
  DocHandle as AMDocHandle,
} from "@automerge/automerge-repo/slim";
import {
  deleteAt as amDeleteAt,
  insertAt as amInsertAt,
  RawString,
} from "@automerge/automerge-repo/slim";
import type { DocumentId, DocumentHandle } from "../types.js";

// Re-export RawString class for creating immutable strings in documents
export { RawString };

// Re-export internal types for SDK internal use
export type {
  AMDocumentId,
  AMAnyDocumentId,
  AMDoc,
  AMDocHandle,
  Repo,
  NetworkAdapterInterface,
};

// Re-export AnyDocumentId for use with repo.find
export type { AMAnyDocumentId as AutomergeAnyDocumentId };

// Re-export internal functions
export {
  BrowserWebSocketClientAdapter,
  IndexedDBStorageAdapter,
  amIsValidDocumentId,
  amDeleteAt,
  amInsertAt,
};

/**
 * Convert an SDK DocumentId to an Automerge DocumentId.
 * The SDK uses a branded string type while Automerge uses its own branded type.
 * This function performs the necessary type assertion.
 */
export function toAMDocumentId(id: DocumentId | string): AMDocumentId {
  return id as string as AMDocumentId;
}

/**
 * Convert an Automerge DocumentId to an SDK DocumentId.
 * The SDK uses a branded string type while Automerge uses its own branded type.
 * This function performs the necessary type assertion.
 */
export function fromAMDocumentId(id: AMDocumentId): DocumentId {
  return id as string as DocumentId;
}

/**
 * Check if a string is a valid document ID (SDK-side).
 */
export function isValidDocumentId(id: string): id is DocumentId {
  return amIsValidDocumentId(id);
}

/**
 * Create a Repo instance with the given configuration.
 */
export function createRepo(options: {
  storageName: string;
  syncUrl?: string | null;
  offlineOnly?: boolean;
}): Repo {
  const { storageName, syncUrl, offlineOnly = false } = options;

  const network: NetworkAdapterInterface[] = [];

  if (!offlineOnly && syncUrl) {
    network.push(new BrowserWebSocketClientAdapter(syncUrl));
  }

  return new Repo({
    storage: new IndexedDBStorageAdapter(storageName),
    network,
  });
}

/**
 * Wrap an Automerge DocHandle into an SDK DocumentHandle.
 */
export function wrapHandle<T>(handle: AMDocHandle<T>): DocumentHandle<T> {
  return {
    documentId: fromAMDocumentId(handle.documentId),
    doc: () => handle.doc() as T | undefined,
    change: (fn: (doc: T) => void) => handle.change(fn),
    isLoading: () => handle.inState(["loading"]),
    isDeleted: () => handle.isDeleted(),
    inState: (states: string[]) =>
      handle.inState(states as Parameters<typeof handle.inState>[0]),
    on: (event, callback) => {
      const wrappedCallback = callback as Parameters<typeof handle.on>[1];
      handle.on(event as Parameters<typeof handle.on>[0], wrappedCallback);
      // Return an unsubscribe function
      return () => {
        handle.off(event as Parameters<typeof handle.off>[0], wrappedCallback);
      };
    },
    off: (event, callback) =>
      handle.off(
        event as Parameters<typeof handle.off>[0],
        callback as Parameters<typeof handle.off>[1],
      ),
    broadcast: (message: unknown) => handle.broadcast(message),
  };
}

/**
 * Array mutation helpers that work with Automerge documents.
 */
export const arrayHelpers = {
  insertAt: amInsertAt,
  deleteAt: amDeleteAt,
};
