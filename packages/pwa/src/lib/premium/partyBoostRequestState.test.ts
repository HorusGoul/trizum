import { describe, expect, it } from "vite-plus/test";
import {
  PartyBoostRequestGate,
  shouldInvalidatePartyBoostCache,
} from "./partyBoostRequestState.ts";

describe("PartyBoostRequestGate", () => {
  it("invalidates a status read when a newer mutation completes", () => {
    const requests = new PartyBoostRequestGate();
    const staleRead = requests.beginRead();

    requests.invalidateReads();

    expect(requests.isCurrent(staleRead)).toBe(false);
  });
});

describe("shouldInvalidatePartyBoostCache", () => {
  it("preserves stale state only for availability failures", () => {
    expect(shouldInvalidatePartyBoostCache("unavailable")).toBe(false);
    expect(shouldInvalidatePartyBoostCache("membership_required")).toBe(true);
    expect(shouldInvalidatePartyBoostCache("unauthorized")).toBe(true);
  });
});
