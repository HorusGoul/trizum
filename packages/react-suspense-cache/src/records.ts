import { STATUS_PENDING, STATUS_REJECTED, STATUS_RESOLVED } from "./constants.js";
import { createDeferred } from "./deferred.js";
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
    status: STATUS_PENDING,
  };
}

export function createResolvedRecordData<Type>(
  value: Type,
  metadata: unknown = null,
): ResolvedRecordData<Type> {
  return {
    metadata,
    status: STATUS_RESOLVED,
    value,
  };
}

export function createRejectedRecordData(error: unknown): RejectedRecordData {
  return {
    error,
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

export function createRejectedRecord(error: unknown): RejectedRecord {
  return { data: createRejectedRecordData(error) };
}

export function updateRecordToResolved<Type>(record: Record<Type>, value: Type): void {
  record.data = createResolvedRecordData(value);
}

export function updateRecordToRejected(record: Record<any>, error: unknown): void {
  record.data = createRejectedRecordData(error);
}

export function isPendingRecord<Type>(record: Record<Type>): record is PendingRecord<Type> {
  return record.data.status === STATUS_PENDING;
}

export function isResolvedRecord<Type>(record: Record<Type>): record is ResolvedRecord<Type> {
  return record.data.status === STATUS_RESOLVED;
}

export function isRejectedRecord<Type>(record: Record<Type>): record is RejectedRecord {
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
): recordData is RejectedRecordData {
  return recordData.status === STATUS_REJECTED;
}
