import type {
  STATUS_ABORTED,
  STATUS_NOT_FOUND,
  STATUS_PENDING,
  STATUS_REJECTED,
  STATUS_RESOLVED,
} from "./constants.js";

export type StatusNotFound = typeof STATUS_NOT_FOUND;
export type StatusPending = typeof STATUS_PENDING;
export type StatusAborted = typeof STATUS_ABORTED;
export type StatusRejected = typeof STATUS_REJECTED;
export type StatusResolved = typeof STATUS_RESOLVED;

export type Status =
  | StatusNotFound
  | StatusPending
  | StatusAborted
  | StatusRejected
  | StatusResolved;

export type CacheLoadOptions = {
  readonly signal: AbortSignal;
};

export type ReactPromiseStatus = "pending" | "fulfilled" | "rejected";

export type PendingReactUsePromise<Type> = Promise<Type> & {
  reason?: never;
  status: "pending";
  value?: never;
};

export type FulfilledReactUsePromise<Type> = Promise<Type> & {
  reason?: never;
  status: "fulfilled";
  value: Type;
};

export type RejectedReactUsePromise<Type> = Promise<Type> & {
  reason: unknown;
  status: "rejected";
  value?: never;
};

export type ReactUsePromise<Type> =
  | PendingReactUsePromise<Type>
  | FulfilledReactUsePromise<Type>
  | RejectedReactUsePromise<Type>;

export interface Deferred<Type> {
  readonly debugLabel: string | undefined;
  readonly promise: ReactUsePromise<Type>;
  reject(error: unknown): void;
  resolve(value: Type): void;
  readonly status: StatusPending | StatusRejected | StatusResolved;
}

export type PendingRecordData<Type> = {
  readonly abortController: AbortController;
  readonly deferred: Deferred<Type>;
  readonly promise: ReactUsePromise<Type>;
  readonly status: StatusPending;
};

export type ResolvedRecordData<Type> = {
  readonly metadata: unknown;
  readonly promise: ReactUsePromise<Type>;
  readonly status: StatusResolved;
  readonly value: Type;
};

export type RejectedRecordData<Type = never> = {
  readonly error: unknown;
  readonly promise: ReactUsePromise<Type>;
  readonly status: StatusRejected;
};

export type PendingRecord<Type> = {
  data: PendingRecordData<Type>;
};

export type ResolvedRecord<Type> = {
  data: ResolvedRecordData<Type>;
};

export type RejectedRecord<Type = never> = {
  data: RejectedRecordData<Type>;
};

export type Record<Type> = PendingRecord<Type> | ResolvedRecord<Type> | RejectedRecord<Type>;

export type RecordData<Type> =
  | PendingRecordData<Type>
  | ResolvedRecordData<Type>
  | RejectedRecordData<Type>;

export interface SubscriptionDataNotFound {
  readonly status: StatusNotFound;
}

export interface SubscriptionDataPending {
  readonly status: StatusPending;
}

export interface SubscriptionDataAborted {
  readonly status: StatusAborted;
}

export interface SubscriptionDataRejected {
  readonly error: unknown;
  readonly status: StatusRejected;
}

export interface SubscriptionDataResolved<Type> {
  readonly status: StatusResolved;
  readonly value: Type;
}

export type SubscriptionData<Type> =
  | SubscriptionDataNotFound
  | SubscriptionDataPending
  | SubscriptionDataAborted
  | SubscriptionDataRejected
  | SubscriptionDataResolved<Type>;

export type SubscriptionCallback<Value> = (data: SubscriptionData<Value>) => void;
export type UnsubscribeCallback = () => void;

export interface CacheMap<Key, Value> {
  clear(): void;
  delete(key: Key): boolean;
  get(key: Key): Value | undefined;
  has(key: Key): boolean;
  set(key: Key, value: Value): this;
}

export interface Cache<Params extends Array<any>, Value> {
  abort(...params: Params): boolean;
  cache(value: Value, ...params: Params): void;
  evict(...params: Params): boolean;
  evictAll(): void;
  getStatus(...params: Params): Status;
  getValue(...params: Params): Value;
  getValueIfCached(...params: Params): Value | undefined;
  prefetch(...params: Params): void;
  read(...params: Params): Value;
  readAsync(...params: Params): ReactUsePromise<Value>;
  subscribe(callback: SubscriptionCallback<Value>, ...params: Params): UnsubscribeCallback;
}

export type CreateCacheOptions<Params extends Array<any>, Value> = {
  config?: {
    getCache?: (onEviction: (key: string) => void) => CacheMap<string, Record<Value>>;
    immutable?: boolean;
  };
  debugLabel?: string;
  getKey?: (params: Params) => string;
  load: (params: Params, loadOptions: CacheLoadOptions) => PromiseLike<Value> | Value;
};

export type InternalCache<Params extends Array<any>, Value> = Cache<Params, Value> & {
  __getKey: (params: Params) => string;
  __getOrCreateRecord: (...params: Params) => Record<Value>;
  __notifySubscribers: (params: Params, data?: SubscriptionData<Value>) => void;
  __recordMap: CacheMap<string, Record<Value>>;
};

export type ExternallyManagedCache<Params extends Array<any>, Value> = Omit<
  Cache<Params, Value>,
  "cache"
> & {
  cacheError(error: unknown, ...params: Params): void;
  cacheValue(value: Value, ...params: Params): void;
};
