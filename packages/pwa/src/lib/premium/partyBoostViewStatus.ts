import type { PartyBoostStatus } from "../api/premiumContract";
import type { PartyBoostSnapshot } from "../../models/party";

export interface PartyBoostViewStatus {
  currentUser: PartyBoostStatus["currentUser"] | null;
  party: PartyBoostStatus["party"];
}

/** Shared local state is usable without an account, but never grants personal Premium. */
export function getPartyBoostViewStatus(
  personal: PartyBoostStatus | null,
  shared: PartyBoostSnapshot | undefined,
): PartyBoostViewStatus | null {
  if (!shared) return personal;
  const isBoosted = getPartyBoostCount(shared) > 0;
  return {
    currentUser: personal?.currentUser ?? null,
    party: {
      isBoosted,
      isBoostedByCurrentUser: isBoosted && (personal?.party.isBoostedByCurrentUser ?? false),
    },
  };
}

/** Only for local features; server operations must verify the entitlement independently. */
export function getPartyBoostCount(shared: PartyBoostSnapshot | undefined): number {
  return Object.keys(shared ?? {}).length;
}

/** Refresh eligibility on contributions/ownership changes, never on verification timestamps. */
export function getPartyBoostMembershipKey(shared: PartyBoostSnapshot | undefined): string {
  return JSON.stringify(
    Object.entries(shared ?? {})
      .map(([id, boost]) => [id, boost.participantId])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}
