import { STATUS_PENDING, STATUS_REJECTED, STATUS_RESOLVED } from "./constants.js";
import { createDeferred } from "./deferred.js";
import { createFulfilledReactPromise, createRejectedReactPromise } from "./promise.js";
import type {
  Deferred,
  PendingRecord,
  PendingRecordData,
  Record,
  RecordData,
  RejectedRecord,
  RejectedRecordData,
  ResolvedRecord,
  ResolvedRecordData,
} from "./types.js";

export function createPendingRecordData<Type>(
  deferred: Deferred<Type> = createDeferred<Type>(),
  abortController: AbortController = new AbortController(),
): PendingRecordData<Type> {
  return {
    abortController,
    deferred,
    promise: deferred.promise,
    status: STATUS_PENDING,
  };
}

export function createResolvedRecordData<Type>(
  value: Type,
  metadata: unknown = null,
  promise = createFulfilledReactPromise(value),
): ResolvedRecordData<Type> {
  return {
    metadata,
    promise,
    status: STATUS_RESOLVED,
    value,
  };
}

export function createRejectedRecordData<Type = never>(
  error: unknown,
  promise = createRejectedReactPromise<Type>(error),
): RejectedRecordData<Type> {
  return {
    error,
    promise,
    status: STATUS_REJECTED,
  };
}

export function createPendingRecord<Type>(
  deferred: Deferred<Type> = createDeferred<Type>(),
  abortController: AbortController = new AbortController(),
): PendingRecord<Type> {
  return { data: createPendingRecordData(deferred, abortController) };
}

export function createResolvedRecord<Type>(value: Type): ResolvedRecord<Type> {
  return { data: createResolvedRecordData(value) };
}

export function createRejectedRecord<Type = never>(error: unknown): RejectedRecord<Type> {
  return { data: createRejectedRecordData(error) };
}

export function updateRecordToResolved<Type>(record: Record<Type>, value: Type): void {
  const pendingData = isPendingRecord(record) ? record.data : undefined;

  pendingData?.deferred.resolve(value);
  record.data = createResolvedRecordData(value, null, pendingData?.promise);
}

export function updateRecordToRejected<Type>(record: Record<Type>, error: unknown): void {
  const pendingData = isPendingRecord(record) ? record.data : undefined;

  pendingData?.deferred.reject(error);
  record.data = createRejectedRecordData<Type>(error, pendingData?.promise);
}

export function isPendingRecord<Type>(record: Record<Type>): record is PendingRecord<Type> {
  return record.data.status === STATUS_PENDING;
}

export function isResolvedRecord<Type>(record: Record<Type>): record is ResolvedRecord<Type> {
  return record.data.status === STATUS_RESOLVED;
}

export function isRejectedRecord<Type>(record: Record<Type>): record is RejectedRecord<Type> {
  return record.data.status === STATUS_REJECTED;
}

export function isPendingRecordData<Type>(
  recordData: RecordData<Type>,
): recordData is PendingRecordData<Type> {
  return recordData.status === STATUS_PENDING;
}

export function isResolvedRecordData<Type>(
  recordData: RecordData<Type>,
): recordData is ResolvedRecordData<Type> {
  return recordData.status === STATUS_RESOLVED;
}

export function isRejectedRecordData<Type>(
  recordData: RecordData<Type>,
): recordData is RejectedRecordData<Type> {
  return recordData.status === STATUS_REJECTED;
}
