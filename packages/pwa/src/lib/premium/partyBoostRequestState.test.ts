import { describe, expect, it } from "vite-plus/test";
import {
  PartyBoostRequestGate,
  shouldInvalidatePartyBoostCache,
} from "./partyBoostRequestState.ts";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("PartyBoostRequestGate", () => {
  it("invalidates a status read when a newer mutation completes", () => {
    const requests = new PartyBoostRequestGate();
    const staleRead = requests.beginRead("user-a:party-a");

    requests.beginMutation("user-a:party-a");
    requests.finishMutation("user-a:party-a");

    expect(requests.isCurrent(staleRead)).toBe(false);
  });

  it.each(["succeeds", "fails"] as const)(
    "preserves the new context read when an older context mutation %s",
    async (outcome) => {
      const requests = new PartyBoostRequestGate();
      const activation = createDeferred<void>();
      const newContextStatus = createDeferred<string>();
      let displayedContext: string | null = null;

      requests.beginMutation("user-a:party-a");
      const activationCompletion = activation.promise.then(
        () => {
          if (requests.finishMutation("user-a:party-a")) {
            displayedContext = "user-a:party-a";
          }
        },
        () => {
          if (requests.finishMutation("user-a:party-a")) {
            displayedContext = "user-a:party-a";
          }
        },
      );

      const newContextRead = requests.beginRead("user-b:party-b");
      const newContextCompletion = newContextStatus.promise.then((context) => {
        if (requests.isCurrent(newContextRead)) {
          displayedContext = context;
        }
      });

      if (outcome === "succeeds") {
        activation.resolve();
      } else {
        activation.reject(new Error("activation failed"));
      }
      await activationCompletion;

      newContextStatus.resolve("user-b:party-b");
      await newContextCompletion;

      expect(displayedContext).toBe("user-b:party-b");
    },
  );
});

describe("shouldInvalidatePartyBoostCache", () => {
  it("preserves stale state only for availability failures", () => {
    expect(shouldInvalidatePartyBoostCache("unavailable")).toBe(false);
    expect(shouldInvalidatePartyBoostCache("membership_required")).toBe(true);
    expect(shouldInvalidatePartyBoostCache("unauthorized")).toBe(true);
  });
});
