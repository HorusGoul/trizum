export type PartyBoostRevocationReason = "owner_not_member" | "premium_inactive";

export interface PartyBoostAssignmentStatus {
  active: boolean;
  assignedAt: number;
  partyDocumentId: string;
  revocationReason: PartyBoostRevocationReason | null;
  revokedAt: number | null;
  transferableAt: number;
}

export interface PartyBoostStatus {
  currentUser: {
    assignment: PartyBoostAssignmentStatus | null;
    isPremium: boolean;
  };
  party: {
    isBoosted: boolean;
    isBoostedByCurrentUser: boolean;
  };
}

export type PartyBoostErrorCode =
  | "already_boosted"
  | "invalid_party"
  | "membership_required"
  | "premium_required"
  | "transfer_locked"
  | "unauthorized"
  | "unavailable";
