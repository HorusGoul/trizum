import { createReadScope } from "./readScope.ts";
import type { DocumentId, Repo } from "@automerge/automerge-repo/slim";

/** Temporary peer unavailability must not turn a loading profile into a cached miss. */
export async function loadRecord(repo: Repo, id: DocumentId, signal: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();

    const attemptScope = createReadScope([signal], 3_000);

    try {
      return await repo.find<object>(id, {
        allowableStates: ["ready"],
        signal: attemptScope.signal,
      });
    } catch (error) {
      signal.throwIfAborted();

      if (attempt === 9) {
        if (repo.handles[id]?.isUnavailable()) return undefined;

        throw error;
      }

      await delay(Math.min(100 * 2 ** attempt, 10_000), signal);
    } finally {
      attemptScope.dispose();
    }
  }
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);

    function onAbort() {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason);
    }

    signal.addEventListener("abort", onAbort, { once: true });

    if (signal.aborted) onAbort();
  });
}
