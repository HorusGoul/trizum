import {
  ConnectionTag,
  getSelectionPlan,
  getListEntries,
  subscribeToJazzFateCacheUpdates,
  toEntityId,
  type ConnectionMetadata,
  type List,
  type Request,
  type RequestOptions,
  type TrizumFateClient,
  type View,
  type ViewRef,
  type ViewSnapshot,
} from "@trizum/data";
import { use, useRef, useSyncExternalStore, useState } from "react";
import { useTrizumData } from "./TrizumDataContext.ts";

type Unsubscribe = () => void;

type FateStore = {
  getListState(key: string): List | undefined;
  missingForSelection(id: string, paths: ReadonlySet<string>): Set<string>;
  subscribe(id: string, selection: ReadonlySet<string> | null, fn: () => void): Unsubscribe;
  subscribeList(key: string, fn: () => void): Unsubscribe;
};

type FateRequestItem = {
  ids?: Array<string | number>;
  kind: string;
  listKey?: string;
  name?: string;
  plan?: {
    paths: ReadonlySet<string>;
  };
  queryKey?: string;
  type?: string;
};

type FateRequestHandle = PromiseLike<unknown> & {
  descriptor?: {
    items?: FateRequestItem[];
  };
  status?: "fulfilled" | "pending" | "rejected";
};

type FateClientInternals = {
  hasRequestData?: (descriptor: NonNullable<FateRequestHandle["descriptor"]>) => boolean;
  requests?: Map<string, Map<string, FateRequestHandle>>;
  rootRequests?: Map<string, string | null>;
  store: FateStore;
};

type FateConnection<NodeRef> = {
  items?: Array<{
    cursor?: string;
    node: NodeRef;
  }>;
  pagination?: {
    hasNext?: boolean;
    hasPrevious?: boolean;
    nextCursor?: string;
    previousCursor?: string;
  };
  [ConnectionTag]?: ConnectionMetadata;
};

type FateListResult<NodeRef> = {
  hasNext: boolean;
  hasPrevious: boolean;
  isLoadingNext: boolean;
  isLoadingPrevious: boolean;
  items: Array<{
    cursor?: string;
    node: NodeRef;
  }>;
  loadNext: () => void;
  loadPrevious: () => void;
};

type FateViewHandle<T extends { __typename: string }> = PromiseLike<ViewSnapshot<T, any>> & {
  status?: "fulfilled" | "pending" | "rejected";
  value?: ViewSnapshot<T, any>;
};

type FateViewSnapshotResult<T extends { __typename: string }> =
  | { snapshot: ViewSnapshot<T, any> }
  | { handle: FateViewHandle<T> };

export function useFateRequest<R extends Request>(
  request: R,
  options?: RequestOptions,
): Awaited<ReturnType<TrizumFateClient["requestForRender"]>> {
  const { client } = useTrizumData();
  const mode = options?.mode ?? "cache-first";
  const { promise, requestKey } = client.prepareRequestForRender(request, options);
  const requestHandle = promise as FateRequestHandle;
  const previousRequestKeyRef = useRef<string | null>(null);
  const previousResultRef = useRef<Awaited<
    ReturnType<TrizumFateClient["requestForRender"]>
  > | null>(null);

  if (previousRequestKeyRef.current !== requestKey) {
    previousRequestKeyRef.current = requestKey;
    previousResultRef.current = null;
  }

  const previousResult = previousResultRef.current;
  const hasPreviousResult = previousResult !== null;
  const hasCurrentData =
    requestHandle.status === "fulfilled" || hasCachedRequestData(client, requestHandle);
  const shouldSuspend = !hasPreviousResult && shouldSuspendForRequest(client, requestHandle, mode);

  useSubscriptionVersion((change) => subscribeToRequest(client, requestKey, mode, change));

  if (shouldSuspend) {
    use(promise);
  }

  if (!hasCurrentData && hasPreviousResult) {
    return previousResult;
  }

  const result = client.getRequestResult(request) as Awaited<
    ReturnType<TrizumFateClient["requestForRender"]>
  >;

  previousResultRef.current = result;

  return result;
}

function shouldSuspendForRequest(
  client: TrizumFateClient,
  request: FateRequestHandle,
  mode: RequestOptions["mode"],
) {
  if (request.status === "fulfilled") {
    return false;
  }

  if (mode !== "network-only" && hasCachedRequestData(client, request)) {
    return false;
  }

  return true;
}

function hasCachedRequestData(client: TrizumFateClient, request: FateRequestHandle) {
  const descriptor = request.descriptor;
  const hasRequestData = (client as unknown as FateClientInternals).hasRequestData;

  if (!descriptor || typeof hasRequestData !== "function") {
    return false;
  }

  try {
    return hasRequestData.call(client, descriptor) === true;
  } catch {
    return false;
  }
}

export function useFateLiveView<T extends { __typename: string }>(
  view: View<T, any>,
  ref: ViewRef<T["__typename"]>,
): T {
  return useFateView(view, ref, { live: true });
}

export function useFateCachedView<T extends { __typename: string }>(
  view: View<T, any>,
  ref: ViewRef<T["__typename"]>,
): T | null {
  const { client } = useTrizumData();
  const entityId = toEntityId(ref.__typename, ref.id);
  const subscriptionVersion = useSubscriptionVersion((change) => {
    const unsubscribeRecord = getFateStore(client).subscribe(entityId, null, change);
    const unsubscribeCacheUpdate = subscribeToJazzFateCacheUpdates(client, change);

    return () => {
      unsubscribeCacheUpdate();
      unsubscribeRecord();
    };
  });
  const snapshot = readCachedViewSnapshot(client, view, ref);

  return snapshot ? readCachedViewData(client, view, ref, snapshot, subscriptionVersion) : null;
}

export function useFateView<T extends { __typename: string }>(
  view: View<T, any>,
  ref: ViewRef<T["__typename"]>,
  options: {
    live?: boolean;
  } = {},
): T {
  const { client } = useTrizumData();
  const previousSnapshotRef = useRef<ViewSnapshot<T, any> | null>(null);
  const subscriptionVersion = useSubscriptionVersion((change) =>
    subscribeToView(client, view, ref, previousSnapshotRef.current, options.live === true, change),
  );
  const snapshotResult = readViewSnapshotForRender(client, view, ref, previousSnapshotRef.current);
  const snapshot =
    "snapshot" in snapshotResult ? snapshotResult.snapshot : use(snapshotResult.handle);

  previousSnapshotRef.current = snapshot;

  return readCachedViewData(client, view, ref, snapshot, subscriptionVersion);
}

export function useFateLiveViews<T extends { __typename: string }>(
  view: View<T, any>,
  refs: readonly ViewRef<T["__typename"]>[],
): T[] {
  const { client } = useTrizumData();
  const previousSnapshotsRef = useRef(new Map<string, ViewSnapshot<T, any>>());
  const subscriptionVersion = useSubscriptionVersion((change) =>
    subscribeToViews(client, view, refs, previousSnapshotsRef.current, true, change),
  );
  const snapshots: Array<ViewSnapshot<T, any>> = [];

  for (const ref of refs) {
    const snapshotResult = readViewSnapshotForRender(
      client,
      view,
      ref,
      previousSnapshotsRef.current.get(getViewSnapshotKey(ref)),
    );
    const snapshot =
      "snapshot" in snapshotResult ? snapshotResult.snapshot : use(snapshotResult.handle);
    snapshots.push(snapshot);
    previousSnapshotsRef.current.set(getViewSnapshotKey(ref), snapshot);
  }

  return refs.map((ref, index) =>
    readCachedViewData(client, view, ref, snapshots[index]!, subscriptionVersion),
  );
}

export function useFateLiveListView<T extends { __typename: string }>(
  view: unknown,
  connection: FateConnection<ViewRef<T["__typename"]>>,
): FateListResult<ViewRef<T["__typename"]>> {
  const { client } = useTrizumData();
  const metadata = getConnectionMetadata(connection);
  const nodeView = getConnectionNodeView(view);
  const [loadingDirection, setLoadingDirection] = useState<"backward" | "forward" | null>(null);

  useSubscriptionVersion((change) => {
    const unsubscribeList = getFateStore(client).subscribeList(metadata.key, change);
    const unsubscribeLive = client.subscribeLiveListView(nodeView, metadata);
    const unsubscribeCacheUpdate = subscribeToJazzFateCacheUpdates(client, change);

    return () => {
      unsubscribeCacheUpdate();
      unsubscribeLive();
      unsubscribeList();
    };
  });

  return toListResult(client, nodeView, metadata, loadingDirection, async (direction, cursor) => {
    setLoadingDirection(direction);

    try {
      await client.loadConnection(
        nodeView,
        metadata,
        direction === "forward" ? { after: cursor } : { before: cursor },
        {
          direction,
        },
      );
    } finally {
      setLoadingDirection(null);
    }
  });
}

function useSubscriptionVersion(subscribe: (change: () => void) => Unsubscribe) {
  const versionRef = useRef(0);

  return useSyncExternalStore(
    (change) => {
      return subscribe(() => {
        versionRef.current += 1;
        change();
      });
    },
    () => versionRef.current,
    () => 0,
  );
}

function subscribeToRequest(
  client: TrizumFateClient,
  requestKey: string,
  mode: RequestOptions["mode"] | undefined,
  change: () => void,
) {
  const internals = client as unknown as FateClientInternals;
  const retain = client.retainRequestKey(requestKey, mode);
  const handle = internals.requests?.get(requestKey)?.get(mode ?? "cache-first");
  const store = getFateStore(client);
  const unsubscribeCacheUpdate = subscribeToJazzFateCacheUpdates(client, change);
  const unsubscribe = (handle?.descriptor?.items ?? []).flatMap((item) => {
    if (item.kind === "list" && item.listKey) {
      return [store.subscribeList(item.listKey, change)];
    }

    if ((item.kind === "node" || item.kind === "nodes") && item.ids && item.type && item.plan) {
      return item.ids.map((id) =>
        store.subscribe(toEntityId(item.type!, id), item.plan!.paths, change),
      );
    }

    if (item.kind === "query" && item.queryKey && item.plan) {
      const entityId = internals.rootRequests?.get(item.queryKey);

      return entityId ? [store.subscribe(entityId, item.plan.paths, change)] : [];
    }

    return [];
  });

  return () => {
    unsubscribeCacheUpdate();

    for (const unsubscribeItem of unsubscribe ?? []) {
      unsubscribeItem();
    }

    retain.dispose();
  };
}

function subscribeToView<T extends { __typename: string }>(
  client: TrizumFateClient,
  view: View<T, any>,
  ref: ViewRef<T["__typename"]>,
  snapshot: ViewSnapshot<T, any> | null | undefined,
  live: boolean,
  change: () => void,
) {
  const store = getFateStore(client);
  const unsubscribeRecords = snapshot
    ? snapshot.coverage.map(([id, paths]) => store.subscribe(id, new Set(paths), change))
    : [store.subscribe(toEntityId(ref.__typename, ref.id), null, change)];
  const unsubscribeLive = live ? client.subscribeLiveView(view, ref) : undefined;
  const unsubscribeCacheUpdate = live ? subscribeToJazzFateCacheUpdates(client, change) : undefined;

  return () => {
    unsubscribeCacheUpdate?.();
    unsubscribeLive?.();

    for (const unsubscribe of unsubscribeRecords) {
      unsubscribe();
    }
  };
}

function subscribeToViews<T extends { __typename: string }>(
  client: TrizumFateClient,
  view: View<T, any>,
  refs: readonly ViewRef<T["__typename"]>[],
  snapshots: ReadonlyMap<string, ViewSnapshot<T, any>>,
  live: boolean,
  change: () => void,
) {
  const unsubscribeItems = refs.map((ref) =>
    subscribeToView(client, view, ref, snapshots.get(getViewSnapshotKey(ref)), live, change),
  );

  return () => {
    for (const unsubscribe of unsubscribeItems) {
      unsubscribe();
    }
  };
}

function readViewSnapshotForRender<T extends { __typename: string }>(
  client: TrizumFateClient,
  view: View<T, any>,
  ref: ViewRef<T["__typename"]>,
  previousSnapshot: ViewSnapshot<T, any> | null | undefined,
): FateViewSnapshotResult<T> {
  const handle = client.readView(view, ref) as FateViewHandle<T>;

  if (handle.status === "fulfilled" && handle.value) {
    return { snapshot: handle.value };
  }

  if (previousSnapshot) {
    return { snapshot: previousSnapshot };
  }

  return { handle };
}

function readCachedViewSnapshot<T extends { __typename: string }>(
  client: TrizumFateClient,
  view: View<T, any>,
  ref: ViewRef<T["__typename"]>,
): ViewSnapshot<T, any> | null {
  const entityId = toEntityId(ref.__typename, ref.id);
  const plan = getSelectionPlan(view, ref);

  if (getFateStore(client).missingForSelection(entityId, plan.paths).size > 0) {
    return null;
  }

  const handle = client.readView(view, ref) as FateViewHandle<T>;

  return handle.status === "fulfilled" && handle.value ? handle.value : null;
}

function getViewSnapshotKey(ref: ViewRef<string>) {
  return toEntityId(ref.__typename, ref.id);
}

function readCachedViewData<T extends { __typename: string }>(
  client: TrizumFateClient,
  view: View<T, any>,
  ref: ViewRef<T["__typename"]>,
  fallback: ViewSnapshot<T, any>,
  subscriptionVersion: number,
): T {
  const snapshot = client.readView(view, subscriptionVersion > 0 ? cloneViewRef(ref) : ref);

  return ("value" in snapshot ? snapshot.value.data : fallback.data) as T;
}

function cloneViewRef<TTypename extends string>(ref: ViewRef<TTypename>): ViewRef<TTypename> {
  const clone = {
    __typename: ref.__typename,
    id: ref.id,
  } as ViewRef<TTypename>;
  const symbolSource = ref as Record<symbol, unknown>;

  // Fate stores view names on a hidden symbol; copy it so a fresh ref still passes view validation.
  for (const symbol of Object.getOwnPropertySymbols(ref)) {
    Object.defineProperty(clone, symbol, {
      configurable: false,
      enumerable: false,
      value: symbolSource[symbol],
      writable: false,
    });
  }

  return Object.freeze(clone);
}

function toListResult<T extends { __typename: string }>(
  client: TrizumFateClient,
  nodeView: View<any, any>,
  metadata: ConnectionMetadata,
  loadingDirection: "backward" | "forward" | null,
  load: (direction: "backward" | "forward", cursor: string | undefined) => Promise<void>,
): FateListResult<ViewRef<T["__typename"]>> {
  const state = getFateStore(client).getListState(metadata.key);
  const entries = getListEntries(state);
  const pagination = state?.pagination;

  return {
    hasNext: pagination?.hasNext === true,
    hasPrevious: pagination?.hasPrevious === true,
    isLoadingNext: loadingDirection === "forward",
    isLoadingPrevious: loadingDirection === "backward",
    items: entries.map(({ cursor, id }) => ({
      cursor,
      node: client.rootListRef(id, nodeView) as ViewRef<T["__typename"]>,
    })),
    loadNext: () => {
      if (pagination?.hasNext === true && loadingDirection === null) {
        void load("forward", pagination.nextCursor);
      }
    },
    loadPrevious: () => {
      if (pagination?.hasPrevious === true && loadingDirection === null) {
        void load("backward", pagination.previousCursor);
      }
    },
  };
}

function getConnectionNodeView(view: unknown): View<any, any> {
  if (view && typeof view === "object" && "items" in view) {
    const items = (view as { items?: { node?: unknown } }).items;

    if (items?.node) {
      return items.node as View<any, any>;
    }
  }

  return view as View<any, any>;
}

function getConnectionMetadata<T extends { __typename: string }>(
  connection: FateConnection<ViewRef<T["__typename"]>>,
) {
  const metadata = connection[ConnectionTag];

  if (!metadata) {
    throw new Error("Fate connection metadata is missing");
  }

  return metadata;
}

function getFateStore(client: TrizumFateClient) {
  return (client as unknown as FateClientInternals).store;
}
