/**
 * React Suspense hooks for loading documents.
 *
 * These hooks integrate with React Suspense to provide a seamless
 * loading experience while fetching documents.
 */

import { useSyncExternalStore } from "react";
import { useInternalRepo } from "../internal/repo-context.js";
import {
  documentCache,
  handleCache,
  multipleDocumentCache,
} from "../cache/document-cache.js";
import type { DocumentHandle, AnyDocumentId } from "../types.js";
import type { AMDocHandle } from "../internal/automerge.js";
import { wrapHandle } from "../internal/automerge.js";

export interface UseSuspenseDocumentOptions {
  /**
   * If true, throws an error when the document is not found.
   * If false, returns undefined for missing documents.
   */
  required?: boolean;
}

/**
 * Get a document handle using Suspense for loading state.
 *
 * This hook suspends during the loading phase and returns the handle
 * once it's ready. Returns undefined if the document doesn't exist.
 *
 * @param id - The document ID to load
 * @returns The document handle, or undefined if not found
 */
export function useSuspenseHandle<T>(
  id: AnyDocumentId,
): DocumentHandle<T> | undefined {
  const repo = useInternalRepo();
  const handle = handleCache.read(repo, id) as AMDocHandle<T> | undefined;

  if (!handle) {
    return undefined;
  }

  return wrapHandle(handle);
}

/**
 * Load a document using Suspense with optional required validation.
 *
 * This hook:
 * 1. Suspends while the document is loading
 * 2. Subscribes to document changes for real-time updates
 * 3. Re-renders when the document changes
 *
 * @param id - The document ID to load
 * @param options - Options for controlling required behavior
 * @returns A tuple of [document, handle]
 */
export function useSuspenseDocument<T>(
  id: AnyDocumentId,
): [T | undefined, DocumentHandle<T> | undefined];
export function useSuspenseDocument<T>(
  id: AnyDocumentId,
  options: UseSuspenseDocumentOptions & { required?: false },
): [T | undefined, DocumentHandle<T> | undefined];
export function useSuspenseDocument<T>(
  id: AnyDocumentId,
  options: UseSuspenseDocumentOptions & { required: true },
): [T, DocumentHandle<T>];
export function useSuspenseDocument<T>(
  id: AnyDocumentId,
  options?: UseSuspenseDocumentOptions,
): [T | undefined, DocumentHandle<T> | undefined] {
  const repo = useInternalRepo();
  const handle = useSuspenseHandle<T>(id);

  // Suspense cache read to ensure the document is loaded
  documentCache.read(repo, id);

  const doc = useSyncExternalStore(
    (change) => {
      return documentCache.subscribe(change, repo, id);
    },
    () => {
      return documentCache.getValueIfCached(repo, id);
    },
  );

  if (options?.required && !doc) {
    throw new Error(`Document not found: ${String(id)}`);
  }

  return [doc as T | undefined, handle] as const;
}

/**
 * Load multiple documents using Suspense.
 *
 * This hook loads all documents in parallel and subscribes to changes
 * on each document for real-time updates.
 *
 * @param ids - Array of document IDs to load
 * @param options - Options for controlling required behavior
 * @returns Array of { doc, handle } objects
 */
export function useMultipleSuspenseDocuments<T>(
  ids: AnyDocumentId[],
): { doc: T | undefined; handle: DocumentHandle<T> }[];
export function useMultipleSuspenseDocuments<T>(
  ids: AnyDocumentId[],
  options: UseSuspenseDocumentOptions & { required?: false },
): { doc: T | undefined; handle: DocumentHandle<T> }[];
export function useMultipleSuspenseDocuments<T>(
  ids: AnyDocumentId[],
  options: UseSuspenseDocumentOptions & { required: true },
): { doc: T; handle: DocumentHandle<T> }[];
export function useMultipleSuspenseDocuments<T>(
  ids: AnyDocumentId[],
  options?: UseSuspenseDocumentOptions,
): { doc: T | undefined; handle: DocumentHandle<T> }[] {
  const repo = useInternalRepo();

  multipleDocumentCache.read(repo, ids);

  const docs = useSyncExternalStore(
    (change) => {
      return multipleDocumentCache.subscribe(change, repo, ids);
    },
    () => {
      return multipleDocumentCache.getValueIfCached(repo, ids);
    },
  );

  if ((options?.required && !docs) || !docs?.every((doc) => doc)) {
    throw new Error(`Document not found: ${ids.join(", ")}`);
  }

  return docs.map((doc, index) => {
    const amHandle = handleCache.read(repo, ids[index]) as
      | AMDocHandle<T>
      | undefined;
    return {
      doc: doc as T | undefined,
      handle: amHandle ? wrapHandle(amHandle) : (undefined as never),
    };
  });
}
