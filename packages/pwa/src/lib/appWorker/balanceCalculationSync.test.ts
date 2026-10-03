import { describe, expect, test, vi } from "vite-plus/test";
import { getHeads } from "@automerge/automerge";
import { Repo } from "@automerge/automerge-repo";
import { waitForBalanceCalculationDependencies } from "./balanceCalculationSync.ts";

describe("waitForBalanceCalculationDependencies", () => {
  test("accepts a document that has advanced beyond the requested version", async () => {
    const repo = new Repo({ network: [] });
    try {
      const handle = repo.create({ value: 1 });
      const heads = getHeads(handle.doc());
      handle.change((doc) => {
        doc.value = 2;
      });
      await expect(
        waitForBalanceCalculationDependencies(
          repo,
          [{ documentId: handle.documentId, heads }],
          new AbortController().signal,
        ),
      ).resolves.toBeUndefined();
    } finally {
      await repo.shutdown();
    }
  });

  test("removes pending document listeners when synchronization is aborted", async () => {
    const repo = new Repo({ network: [] });
    try {
      const handle = repo.create({ value: 1 });
      const other = repo.create({ value: 2 });
      const controller = new AbortController();
      const listenersBefore = handle.listenerCount("change");
      const waiting = waitForBalanceCalculationDependencies(
        repo,
        [{ documentId: handle.documentId, heads: getHeads(other.doc()) }],
        controller.signal,
      );
      await vi.waitFor(() => expect(handle.listenerCount("change")).toBe(listenersBefore + 1));
      controller.abort(new Error("Sync stopped"));
      await expect(waiting).rejects.toThrow("Sync stopped");
      expect(handle.listenerCount("change")).toBe(listenersBefore);
    } finally {
      await repo.shutdown();
    }
  });
});
