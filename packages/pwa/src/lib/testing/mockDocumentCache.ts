import type { DocumentId, Repo } from "@automerge/automerge-repo/slim";
import { STATUS_RESOLVED } from "suspense";
import { vi } from "vitest";

export interface MockDocumentCacheCollection<TDocument> {
  availableDocuments: Map<DocumentId, TDocument>;
  cachedDocuments: Map<DocumentId, TDocument>;
  documentStatuses: Map<DocumentId, string>;
  subscribers: Map<DocumentId, Set<() => void>>;
  documentCache: {
    getStatus: ReturnType<typeof vi.fn>;
    getValueIfCached: ReturnType<typeof vi.fn>;
    readAsync: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  };
  cacheDocument: (documentId: DocumentId) => void;
  notifySubscribers: (documentId: DocumentId) => void;
  reset: () => void;
}

export function createMockDocumentCacheCollection<
  TDocument,
>(): MockDocumentCacheCollection<TDocument> {
  const availableDocuments = new Map<DocumentId, TDocument>();
  const cachedDocuments = new Map<DocumentId, TDocument>();
  const documentStatuses = new Map<DocumentId, string>();
  const subscribers = new Map<DocumentId, Set<() => void>>();

  function notifySubscribers(documentId: DocumentId) {
    subscribers.get(documentId)?.forEach((callback) => callback());
  }

  function cacheDocument(documentId: DocumentId) {
    const document = availableDocuments.get(documentId);

    if (!document) {
      throw new Error(`Document not registered: ${documentId}`);
    }

    cachedDocuments.set(documentId, document);
    documentStatuses.set(documentId, STATUS_RESOLVED);
  }

  const documentCache = {
    getStatus: vi.fn((_: Repo, documentId: DocumentId) => {
      return documentStatuses.get(documentId) ?? "not-found";
    }),
    getValueIfCached: vi.fn((_: Repo, documentId: DocumentId) => {
      return cachedDocuments.get(documentId);
    }),
    readAsync: vi.fn((_: Repo, documentId: DocumentId) => {
      const cachedDocument = cachedDocuments.get(documentId);

      if (cachedDocument) {
        return cachedDocument;
      }

      const availableDocument = availableDocuments.get(documentId);

      if (!availableDocument) {
        return undefined;
      }

      cacheDocument(documentId);
      notifySubscribers(documentId);

      return Promise.resolve(availableDocument);
    }),
    subscribe: vi.fn(
      (callback: () => void, _: Repo, documentId: DocumentId) => {
        const callbacks = subscribers.get(documentId) ?? new Set<() => void>();

        callbacks.add(callback);
        subscribers.set(documentId, callbacks);

        return () => {
          callbacks.delete(callback);

          if (callbacks.size === 0) {
            subscribers.delete(documentId);
          }
        };
      },
    ),
  };

  return {
    availableDocuments,
    cachedDocuments,
    documentStatuses,
    subscribers,
    documentCache,
    cacheDocument,
    notifySubscribers,
    reset() {
      availableDocuments.clear();
      cachedDocuments.clear();
      documentStatuses.clear();
      subscribers.clear();
    },
  };
}
