import { describe, expect, it } from "vite-plus/test";
import {
  canTransferPartyBoost,
  getPartyBoostAssignmentAction,
  getPartyBoostTransferableAt,
  PARTY_BOOST_TRANSFER_INTERVAL_MS,
} from "./partyBoost";

describe("Party Boost transfer timing", () => {
  it("allows a transfer seven days after assignment", () => {
    const assignedAt = Date.UTC(2026, 6, 25);
    const transferableAt = getPartyBoostTransferableAt(assignedAt);

    expect(transferableAt).toBe(assignedAt + PARTY_BOOST_TRANSFER_INTERVAL_MS);
    expect(canTransferPartyBoost({ now: transferableAt - 1, transferableAt })).toBe(false);
    expect(canTransferPartyBoost({ now: transferableAt, transferableAt })).toBe(true);
  });
});

describe("Party Boost assignment", () => {
  const assignment = {
    partyDocumentId: "old-party",
    revokedAt: null,
    transferableAt: 200,
  };

  it("creates the first assignment", () => {
    expect(
      getPartyBoostAssignmentAction({ assignment: null, now: 100, partyDocumentId: "party" }),
    ).toEqual({ type: "create" });
  });

  it("keeps an active assignment on the same party", () => {
    expect(
      getPartyBoostAssignmentAction({ assignment, now: 100, partyDocumentId: "old-party" }),
    ).toEqual({ type: "keep" });
  });

  it("reactivates a revoked assignment without resetting its cooldown", () => {
    expect(
      getPartyBoostAssignmentAction({
        assignment: { ...assignment, revokedAt: 50 },
        now: 100,
        partyDocumentId: "old-party",
      }),
    ).toEqual({ type: "reactivate" });
  });

  it("blocks a transfer before seven days even after revocation", () => {
    expect(
      getPartyBoostAssignmentAction({
        assignment: { ...assignment, revokedAt: 50 },
        now: 199,
        partyDocumentId: "new-party",
      }),
    ).toEqual({ transferableAt: 200, type: "transfer_locked" });
  });

  it("moves an assignment after its cooldown", () => {
    expect(
      getPartyBoostAssignmentAction({ assignment, now: 200, partyDocumentId: "new-party" }),
    ).toEqual({ type: "transfer" });
  });
});
