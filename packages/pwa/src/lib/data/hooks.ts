import { useViews, useView } from "react-fate";
import { RecordView } from "./client.ts";
import { useAppData } from "./useAppData.ts";

export function useDataRecord<T>(id: string, options?: { required?: false }): [T | undefined];
export function useDataRecord<T>(id: string, options: { required: true }): [T];
export function useDataRecord<T>(id: string, options?: { required?: boolean }): [T | undefined] {
  const data = useAppData();
  const snapshot = useView(RecordView, data.ref(id));

  if (options?.required && !snapshot.value) throw new Error("Record unavailable");

  // SAFETY: Domain callers own the opaque ID and its corresponding model.
  return [(snapshot.value ?? undefined) as T | undefined];
}

export function useDataRecords<T>(
  ids: string[],
  options?: { required?: false },
): { doc: T | undefined }[];
export function useDataRecords<T>(ids: string[], options: { required: true }): { doc: T }[];
export function useDataRecords<T>(ids: string[], options?: { required?: boolean }) {
  const data = useAppData();
  const snapshots = useViews(RecordView, ids.map(data.ref));

  return snapshots.map((snapshot) => {
    if (options?.required && !snapshot.value) throw new Error("Record unavailable");

    // SAFETY: Every ID in this domain collection identifies the requested model.
    return { doc: (snapshot.value ?? undefined) as T | undefined };
  });
}
