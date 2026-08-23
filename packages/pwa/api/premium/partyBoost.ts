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
