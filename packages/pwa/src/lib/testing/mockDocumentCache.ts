import type { DocumentId, Repo } from "@automerge/automerge-repo/slim";

const STATUS_RESOLVED = "resolved";

type ReactUsePromise<Value> = Promise<Value> & { status: "fulfilled"; value: Value };

import { vi } from "vite-plus/test";

type DocumentCacheMock<TDocument, Context> = {
  getStatus: (repo: Context, documentId: DocumentId) => string;
  getValueIfCached: (repo: Context, documentId: DocumentId) => TDocument | undefined;
  readAsync: (repo: Context, documentId: DocumentId) => ReactUsePromise<TDocument | undefined>;
  subscribe: (callback: () => void, repo: Context, documentId: DocumentId) => () => void;
};

export interface MockDocumentCacheCollection<TDocument, Context = Repo> {
  availableDocuments: Map<DocumentId, TDocument>;
  cachedDocuments: Map<DocumentId, TDocument>;
  documentStatuses: Map<DocumentId, string>;
  subscribers: Map<DocumentId, Set<() => void>>;
  documentCache: {
    [TKey in keyof DocumentCacheMock<TDocument, Context>]: ReturnType<
      typeof vi.fn<DocumentCacheMock<TDocument, Context>[TKey]>
    >;
  };
  cacheDocument: (documentId: DocumentId) => void;
  notifySubscribers: (documentId: DocumentId) => void;
  reset: () => void;
}

export function createMockDocumentCacheCollection<
  TDocument,
  Context = Repo,
>(): MockDocumentCacheCollection<TDocument, Context> {
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
    getStatus: vi.fn<DocumentCacheMock<TDocument, Context>["getStatus"]>(
      (_: Context, documentId) => {
        return documentStatuses.get(documentId) ?? "not-found";
      },
    ),
    getValueIfCached: vi.fn<DocumentCacheMock<TDocument, Context>["getValueIfCached"]>(
      (_: Context, documentId) => {
        return cachedDocuments.get(documentId);
      },
    ),
    readAsync: vi.fn<DocumentCacheMock<TDocument, Context>["readAsync"]>(
      (_: Context, documentId) => {
        const cachedDocument = cachedDocuments.get(documentId);

        if (cachedDocument) {
          return createFulfilledReadPromise(cachedDocument);
        }

        const availableDocument = availableDocuments.get(documentId);

        if (!availableDocument) {
          return createFulfilledReadPromise(undefined);
        }

        cacheDocument(documentId);
        notifySubscribers(documentId);

        return createFulfilledReadPromise(availableDocument);
      },
    ),
    subscribe: vi.fn<DocumentCacheMock<TDocument, Context>["subscribe"]>(
      (callback, _: Context, documentId) => {
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

function createFulfilledReadPromise<TValue>(value: TValue): ReactUsePromise<TValue> {
  return Object.assign(Promise.resolve(value), { status: "fulfilled" as const, value });
}
