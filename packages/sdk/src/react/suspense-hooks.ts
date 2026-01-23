/**
 * React Suspense hooks for loading Automerge documents.
 *
 * These hooks integrate with React Suspense to provide a seamless
 * loading experience while fetching documents from the Automerge repository.
 */

import type {
  AnyDocumentId,
  Doc,
  DocHandle,
} from "@automerge/automerge-repo/slim";
import { useSyncExternalStore } from "react";
import { useRepo } from "./TrizumProvider.js";
import {
  documentCache,
  handleCache,
  multipleDocumentCache,
} from "../cache/document-cache.js";

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
 *
 * @example
 * ```tsx
 * function PartyDetail({ partyId }: { partyId: DocumentId }) {
 *   const handle = useSuspenseHandle<Party>(partyId);
 *
 *   if (!handle) {
 *     return <div>Party not found</div>;
 *   }
 *
 *   // Use handle.change() to modify the document
 * }
 * ```
 */
export function useSuspenseHandle<T>(
  id: AnyDocumentId,
): DocHandle<T> | undefined {
  const repo = useRepo();

  return handleCache.read(repo, id) as DocHandle<T> | undefined;
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
 *
 * @example
 * ```tsx
 * // Optional document - returns undefined if not found
 * function MaybeParty({ partyId }: { partyId: DocumentId }) {
 *   const [party, handle] = useSuspenseDocument<Party>(partyId);
 *
 *   if (!party) {
 *     return <div>Party not found</div>;
 *   }
 *
 *   return <div>{party.name}</div>;
 * }
 *
 * // Required document - throws if not found
 * function RequiredParty({ partyId }: { partyId: DocumentId }) {
 *   const [party, handle] = useSuspenseDocument<Party>(partyId, { required: true });
 *
 *   // party is guaranteed to exist here
 *   return <div>{party.name}</div>;
 * }
 * ```
 */
export function useSuspenseDocument<T>(
  id: AnyDocumentId,
): [Doc<T> | undefined, DocHandle<T> | undefined];
export function useSuspenseDocument<T>(
  id: AnyDocumentId,
  options: UseSuspenseDocumentOptions & { required?: false },
): [Doc<T> | undefined, DocHandle<T> | undefined];
export function useSuspenseDocument<T>(
  id: AnyDocumentId,
  options: UseSuspenseDocumentOptions & { required: true },
): [Doc<T>, DocHandle<T>];
export function useSuspenseDocument<T>(
  id: AnyDocumentId,
  options?: UseSuspenseDocumentOptions,
): [Doc<T> | undefined, DocHandle<T> | undefined] {
  const repo = useRepo();
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

  return [doc as Doc<T> | undefined, handle] as const;
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
 *
 * @example
 * ```tsx
 * function ExpenseList({ chunkIds }: { chunkIds: DocumentId[] }) {
 *   const chunks = useMultipleSuspenseDocuments<ExpenseChunk>(chunkIds, {
 *     required: true,
 *   });
 *
 *   return (
 *     <ul>
 *       {chunks.flatMap(({ doc }) =>
 *         doc.expenses.map((expense) => (
 *           <li key={expense.id}>{expense.name}</li>
 *         ))
 *       )}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useMultipleSuspenseDocuments<T>(
  ids: AnyDocumentId[],
): { doc: Doc<T> | undefined; handle: DocHandle<T> }[];
export function useMultipleSuspenseDocuments<T>(
  ids: AnyDocumentId[],
  options: UseSuspenseDocumentOptions & { required?: false },
): { doc: Doc<T> | undefined; handle: DocHandle<T> }[];
export function useMultipleSuspenseDocuments<T>(
  ids: AnyDocumentId[],
  options: UseSuspenseDocumentOptions & { required: true },
): { doc: Doc<T>; handle: DocHandle<T> }[];
export function useMultipleSuspenseDocuments<T>(
  ids: AnyDocumentId[],
  options?: UseSuspenseDocumentOptions,
): { doc: Doc<T> | undefined; handle: DocHandle<T> }[] {
  const repo = useRepo();

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

  return docs.map((doc, index) => ({
    doc: doc as Doc<T> | undefined,
    handle: handleCache.read(repo, ids[index]) as DocHandle<T>,
  }));
}
