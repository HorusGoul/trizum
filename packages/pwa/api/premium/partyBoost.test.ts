import { describe, expect, it } from "vite-plus/test";
import {
  canTransferPartyBoost,
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
