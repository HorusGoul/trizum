/**
 * Non-suspense hook for loading documents.
 *
 * Use this when you don't want to use Suspense for loading states
 * and prefer to handle loading/error states manually.
 */

import { useState, useEffect, useCallback } from "react";
import { useTrizumClient } from "./TrizumProvider.js";
import type { DocumentId, DocumentHandle } from "../types.js";

export interface UseDocumentResult<T> {
  /** The document data, or undefined if loading or not found */
  doc: T | undefined;
  /** The document handle for making changes */
  handle: DocumentHandle<T> | undefined;
  /** Whether the document is currently loading */
  isLoading: boolean;
  /** Any error that occurred during loading */
  error: Error | undefined;
  /** Refetch the document */
  refetch: () => void;
}

/**
 * Load a document without using Suspense.
 *
 * This hook manages loading state manually, making it suitable for
 * scenarios where you want explicit control over loading UI.
 *
 * @param id - The document ID to load
 * @returns Object with doc, handle, isLoading, error, and refetch
 */
export function useDocument<T>(
  id: DocumentId | string | undefined,
): UseDocumentResult<T> {
  const client = useTrizumClient();
  const [doc, setDoc] = useState<T | undefined>(undefined);
  const [handle, setHandle] = useState<DocumentHandle<T> | undefined>(
    undefined,
  );
  const [isLoading, setIsLoading] = useState(!!id);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [version, setVersion] = useState(0);

  const refetch = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!id) {
      setDoc(undefined);
      setHandle(undefined);
      setIsLoading(false);
      setError(undefined);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(undefined);

    const loadDocument = async () => {
      try {
        const h = await client.findHandle<T>(id as DocumentId);

        if (cancelled) return;

        if (h.isDeleted()) {
          setDoc(undefined);
          setHandle(undefined);
          setIsLoading(false);
          return;
        }

        setHandle(h);
        setDoc(h.doc());
        setIsLoading(false);

        // Subscribe to changes
        const onChange = () => {
          if (!cancelled) {
            setDoc(h.doc());
          }
        };

        const onDelete = () => {
          if (!cancelled) {
            setDoc(undefined);
          }
        };

        h.on("change", onChange);
        h.on("delete", onDelete);

        return () => {
          h.off("change", onChange);
          h.off("delete", onDelete);
        };
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err : new Error("Failed to load document"),
          );
          setIsLoading(false);
        }
      }
    };

    const cleanupPromise = loadDocument();

    return () => {
      cancelled = true;
      void cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [client, id, version]);

  return {
    doc,
    handle,
    isLoading,
    error,
    refetch,
  };
}
