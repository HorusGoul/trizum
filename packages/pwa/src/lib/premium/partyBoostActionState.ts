import type { PartyBoostViewStatus } from "./partyBoostViewStatus.ts";

export type PartyBoostActionState =
  | { type: "active" }
  | { disabled: boolean; type: "activate" }
  | { type: "boosted_by_other" }
  | { type: "locked" }
  | { disabled: boolean; type: "retry" }
  | { type: "signed_out" }
  | { disabled: boolean; type: "transfer" }
  | { type: "upgrade" };

export function getPartyBoostActionState({
  isActivating,
  isDevicePremium,
  isNativePlatform,
  isRefreshing,
  isSignedIn,
  now,
  partyDocumentId,
  status,
}: {
  isActivating: boolean;
  isDevicePremium: boolean;
  isNativePlatform: boolean;
  isRefreshing: boolean;
  isSignedIn: boolean;
  now: number;
  partyDocumentId: string;
  status: PartyBoostViewStatus | null;
}): PartyBoostActionState {
  if (!status) {
    if (!isSignedIn) return { type: "signed_out" };
    return { disabled: isRefreshing, type: "retry" };
  }

  if (status.party.isBoostedByCurrentUser) {
    return { type: "active" };
  }

  if (status.party.isBoosted) {
    return { type: "boosted_by_other" };
  }

  if (!isSignedIn) {
    return { type: "signed_out" };
  }

  if (!status.currentUser) {
    return { disabled: isRefreshing, type: "retry" };
  }

  const assignment = status.currentUser.assignment;
  const isPremium = status.currentUser.isPremium || isDevicePremium;
  const isInitialWebActivation = !isNativePlatform && assignment === null;
  if (!isPremium && !isInitialWebActivation) {
    return { type: "upgrade" };
  }

  if (!assignment || assignment.partyDocumentId === partyDocumentId) {
    return { disabled: isActivating, type: "activate" };
  }

  if (assignment.transferableAt > now) {
    return { type: "locked" };
  }

  return { disabled: isActivating, type: "transfer" };
}
