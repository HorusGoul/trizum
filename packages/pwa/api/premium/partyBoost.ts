export const PARTY_BOOST_TRANSFER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1_000;

export function getPartyBoostTransferableAt(assignedAt: number) {
  return assignedAt + PARTY_BOOST_TRANSFER_INTERVAL_MS;
}

export function canTransferPartyBoost({
  now,
  transferableAt,
}: {
  now: number;
  transferableAt: number;
}) {
  return now >= transferableAt;
}

export type PartyBoostAssignmentAction =
  | { type: "create" }
  | { type: "keep" }
  | { type: "reactivate" }
  | { type: "transfer" }
  | { transferableAt: number; type: "transfer_locked" };

export function getPartyBoostAssignmentAction({
  assignment,
  now,
  partyDocumentId,
}: {
  assignment: {
    partyDocumentId: string;
    revokedAt: number | null;
    transferableAt: number;
  } | null;
  now: number;
  partyDocumentId: string;
}): PartyBoostAssignmentAction {
  if (!assignment) {
    return { type: "create" };
  }

  if (assignment.partyDocumentId === partyDocumentId) {
    return { type: assignment.revokedAt === null ? "keep" : "reactivate" };
  }

  if (!canTransferPartyBoost({ now, transferableAt: assignment.transferableAt })) {
    return { transferableAt: assignment.transferableAt, type: "transfer_locked" };
  }

  return { type: "transfer" };
}
