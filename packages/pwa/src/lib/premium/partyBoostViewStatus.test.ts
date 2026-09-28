import type { PartyBoost } from "../../models/party";
import { describe, expect, it } from "vite-plus/test";
import {
  getPartyBoostViewStatus,
  getPartyBoostCount,
  getPartyBoostMembershipKey,
} from "./partyBoostViewStatus";

const boost: PartyBoost = {
  boostId: "first",
  participantId: "alice",
  checkedAt: "2026-09-28T10:00:00.000Z",
  boostedAt: "2026-09-27T10:00:00.000Z",
};

describe("shared local Party Boost state", () => {
  it("shows the shared cache without granting personal Premium or ownership", () => {
    expect(getPartyBoostViewStatus(null, { first: boost })).toEqual({
      currentUser: null,
      party: { isBoosted: true, isBoostedByCurrentUser: false },
    });
  });

  it("uses a shared revocation instead of a stale personal cached response", () => {
    expect(
      getPartyBoostViewStatus(
        {
          currentUser: { isPremium: true, assignment: null },
          party: { isBoosted: true, isBoostedByCurrentUser: true },
        },
        {},
      )?.party,
    ).toEqual({
      isBoosted: false,
      isBoostedByCurrentUser: false,
    });
  });

  it("leaves old documents without a snapshot unknown", () => {
    expect(getPartyBoostViewStatus(null, undefined)).toBeNull();
  });
});

it("totals multiple contributions for future local feature limits", () => {
  expect(
    getPartyBoostCount({
      first: boost,
      second: { ...boost, boostId: "second" },
      third: { ...boost, boostId: "third", participantId: "bob" },
    }),
  ).toBe(3);
  expect(getPartyBoostCount(undefined)).toBe(0);
});

it("refreshes only for contribution and owner changes, independent of ordering or timestamps", () => {
  const initial = { first: boost, second: { ...boost, boostId: "second", participantId: "bob" } };
  const key = getPartyBoostMembershipKey(initial);
  expect(
    getPartyBoostMembershipKey({
      second: initial.second,
      first: { ...boost, checkedAt: "later", boostedAt: "later" },
    }),
  ).toBe(key);
  expect(
    getPartyBoostMembershipKey({ ...initial, first: { ...boost, participantId: "carol" } }),
  ).not.toBe(key);
  expect(getPartyBoostMembershipKey({ first: boost })).not.toBe(key);
  expect(getPartyBoostMembershipKey({})).not.toBe(key);
  expect(getPartyBoostMembershipKey(undefined)).toBe(getPartyBoostMembershipKey({}));
});
