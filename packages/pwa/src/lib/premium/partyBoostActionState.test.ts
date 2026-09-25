import { describe, expect, it } from "vite-plus/test";
import type { PartyBoostAssignmentStatus, PartyBoostStatus } from "./partyBoostApi.ts";
import { getPartyBoostActionState } from "./partyBoostActionState.ts";

const currentPartyId = "current-party";

describe("getPartyBoostActionState", () => {
  it("reactivates a revoked assignment on the same party without applying the transfer lock", () => {
    const status = createStatus({
      assignment: createAssignment({
        active: false,
        partyDocumentId: currentPartyId,
        revokedAt: 50,
        transferableAt: 200,
      }),
      isPremium: true,
    });

    expect(getActionState({ now: 100, status })).toEqual({
      disabled: false,
      type: "activate",
    });
  });

  it("locks an assignment elsewhere until its cooldown expires", () => {
    const status = createStatus({
      assignment: createAssignment({ partyDocumentId: "other-party", transferableAt: 200 }),
      isPremium: true,
    });

    expect(getActionState({ now: 199, status })).toEqual({ type: "locked" });
    expect(getActionState({ now: 200, status })).toEqual({
      disabled: false,
      type: "transfer",
    });
  });

  it("uses device entitlement for a first native activation", () => {
    const status = createStatus({ assignment: null, isPremium: false });

    expect(getActionState({ isDevicePremium: true, isNativePlatform: true, status })).toEqual({
      disabled: false,
      type: "activate",
    });
    expect(getActionState({ isDevicePremium: false, isNativePlatform: true, status })).toEqual({
      type: "upgrade",
    });
  });

  it("allows the server to verify a first activation requested from the web", () => {
    const status = createStatus({ assignment: null, isPremium: false });

    expect(getActionState({ isDevicePremium: false, isNativePlatform: false, status })).toEqual({
      disabled: false,
      type: "activate",
    });
  });

  it("disables retry while status is refreshing", () => {
    expect(getActionState({ isRefreshing: true, status: null })).toEqual({
      disabled: true,
      type: "retry",
    });
  });
});

function getActionState({
  isDevicePremium = false,
  isNativePlatform = true,
  isRefreshing = false,
  now = 100,
  status,
}: {
  isDevicePremium?: boolean;
  isNativePlatform?: boolean;
  isRefreshing?: boolean;
  now?: number;
  status: PartyBoostStatus | null;
}) {
  return getPartyBoostActionState({
    isActivating: false,
    isDevicePremium,
    isNativePlatform,
    isRefreshing,
    isSignedIn: true,
    now,
    partyDocumentId: currentPartyId,
    status,
  });
}

function createStatus({
  assignment,
  isPremium,
}: {
  assignment: PartyBoostAssignmentStatus | null;
  isPremium: boolean;
}): PartyBoostStatus {
  return {
    currentUser: { assignment, isPremium },
    party: { isBoosted: false, isBoostedByCurrentUser: false },
  };
}

function createAssignment(
  values: Partial<PartyBoostAssignmentStatus> & Pick<PartyBoostAssignmentStatus, "partyDocumentId">,
): PartyBoostAssignmentStatus {
  return {
    active: true,
    assignedAt: 0,
    revocationReason: null,
    revokedAt: null,
    transferableAt: 0,
    ...values,
  };
}
