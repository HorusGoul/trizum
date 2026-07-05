import { describe, expect, test } from "vite-plus/test";
import { STATUS_PENDING, STATUS_REJECTED, STATUS_RESOLVED } from "./constants.js";
import { createDeferred } from "./deferred.js";
import {
  createPendingRecord,
  createPendingRecordData,
  createRejectedRecord,
  createRejectedRecordData,
  createResolvedRecord,
  createResolvedRecordData,
  isPendingRecord,
  isPendingRecordData,
  isRejectedRecord,
  isRejectedRecordData,
  isResolvedRecord,
  isResolvedRecordData,
  updateRecordToRejected,
  updateRecordToResolved,
} from "./records.js";
import type { RecordData } from "./types.js";

describe("record helpers", () => {
  test("creates pending record data with provided deferred and abort controller", () => {
    const deferred = createDeferred<string>();
    const abortController = new AbortController();
    const data = createPendingRecordData(deferred, abortController);
    const record = createPendingRecord(deferred, abortController);

    expect(data).toEqual({
      abortController,
      deferred,
      status: STATUS_PENDING,
    });
    expect(record.data).toEqual(data);
    expect(isPendingRecord(record)).toBe(true);
    expect(isResolvedRecord(record)).toBe(false);
    expect(isRejectedRecord(record)).toBe(false);
  });

  test("creates resolved and rejected record data", () => {
    const error = new Error("failed");
    const resolvedData = createResolvedRecordData("value", { source: "test" });
    const rejectedData = createRejectedRecordData(error);
    const resolvedRecord = createResolvedRecord("value");
    const rejectedRecord = createRejectedRecord(error);

    expect(resolvedData).toEqual({
      metadata: { source: "test" },
      status: STATUS_RESOLVED,
      value: "value",
    });
    expect(rejectedData).toEqual({
      error,
      status: STATUS_REJECTED,
    });
    expect(resolvedRecord.data).toEqual({
      metadata: null,
      status: STATUS_RESOLVED,
      value: "value",
    });
    expect(rejectedRecord.data).toEqual(rejectedData);
    expect(isResolvedRecord(resolvedRecord)).toBe(true);
    expect(isRejectedRecord(rejectedRecord)).toBe(true);
  });

  test("updates records between resolved and rejected states", () => {
    const error = new Error("failed");
    const record = createPendingRecord<string>();

    updateRecordToResolved(record, "value");

    expect(record.data).toEqual({
      metadata: null,
      status: STATUS_RESOLVED,
      value: "value",
    });

    updateRecordToRejected(record, error);

    expect(record.data).toEqual({
      error,
      status: STATUS_REJECTED,
    });
  });

  test("narrows record data by status", () => {
    const error = new Error("failed");
    const pendingData = createPendingRecordData<string>();
    const resolvedData = createResolvedRecordData("value");
    const rejectedData = createRejectedRecordData(error);
    const allData: Array<RecordData<string>> = [pendingData, resolvedData, rejectedData];

    expect(allData.map((data) => isPendingRecordData(data))).toEqual([true, false, false]);
    expect(allData.map((data) => isResolvedRecordData(data))).toEqual([false, true, false]);
    expect(allData.map((data) => isRejectedRecordData(data))).toEqual([false, false, true]);
  });
});
