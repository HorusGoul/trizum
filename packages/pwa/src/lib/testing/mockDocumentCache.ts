import type { DocumentId, Repo } from "@automerge/automerge-repo/slim";
import { STATUS_RESOLVED } from "@trizum/react-suspense-cache";
import { vi } from "vite-plus/test";

type DocumentCacheMock<TDocument> = {
  getStatus: (repo: Repo, documentId: DocumentId) => string;
  getValueIfCached: (repo: Repo, documentId: DocumentId) => TDocument | undefined;
  readAsync: (repo: Repo, documentId: DocumentId) => TDocument | Promise<TDocument> | undefined;
  subscribe: (callback: () => void, repo: Repo, documentId: DocumentId) => () => void;
};

export interface MockDocumentCacheCollection<TDocument> {
  availableDocuments: Map<DocumentId, TDocument>;
  cachedDocuments: Map<DocumentId, TDocument>;
  documentStatuses: Map<DocumentId, string>;
  subscribers: Map<DocumentId, Set<() => void>>;
  documentCache: {
    [TKey in keyof DocumentCacheMock<TDocument>]: ReturnType<
      typeof vi.fn<DocumentCacheMock<TDocument>[TKey]>
    >;
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
    getStatus: vi.fn<DocumentCacheMock<TDocument>["getStatus"]>((_: Repo, documentId) => {
      return documentStatuses.get(documentId) ?? "not-found";
    }),
    getValueIfCached: vi.fn<DocumentCacheMock<TDocument>["getValueIfCached"]>(
      (_: Repo, documentId) => {
        return cachedDocuments.get(documentId);
      },
    ),
    readAsync: vi.fn<DocumentCacheMock<TDocument>["readAsync"]>((_: Repo, documentId) => {
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
    subscribe: vi.fn<DocumentCacheMock<TDocument>["subscribe"]>((callback, _: Repo, documentId) => {
      const callbacks = subscribers.get(documentId) ?? new Set<() => void>();

      callbacks.add(callback);
      subscribers.set(documentId, callbacks);

      return () => {
        callbacks.delete(callback);

        if (callbacks.size === 0) {
          subscribers.delete(documentId);
        }
      };
    }),
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
