import { describe, expect, it } from "vite-plus/test";
import { balanceStates, expenseAmounts, HEADER_DURATION } from "./data.ts";
import { balancesAt } from "./motion.ts";
import { renderHeaderScene } from "./header.ts";

describe("creative header story", () => {
  it("keeps the expense ledger and repayments consistent", () => {
    const paid = [0, 0, 0];
    expenseAmounts.forEach((amount, payer) => {
      for (let person = 0; person < 3; person++)
        paid[person] += (payer === person ? amount : 0) - amount / 3;
      expect(paid).toEqual(balanceStates[payer + 1]);
    });
    expect(balancesAt(12.9)).toEqual([1000, 0, -1000]);
    expect(balancesAt(15.1)).toEqual([0, 0, 0]);
  });

  it("preserves zero-sum balances throughout the encoded timeline", () => {
    for (let frame = 0; frame < HEADER_DURATION * 60; frame++) {
      expect(balancesAt(frame / 60).reduce((total, amount) => total + amount, 0)).toBe(0);
    }
  });

  it("returns to the same opening artwork in both languages", () => {
    for (const locale of ["en", "es"] as const)
      expect(renderHeaderScene(0, locale)).toBe(renderHeaderScene(HEADER_DURATION, locale));
  });
});
