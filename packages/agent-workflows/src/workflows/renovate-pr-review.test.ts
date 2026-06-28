import { describe, expect, test } from "vite-plus/test";
import { canUpdateOriginalRenovatePr } from "./renovate-pr-review.js";

describe("Renovate PR review workflow", () => {
  test("allows updating the original PR for lockfile and workspace metadata fixes", () => {
    expect(canUpdateOriginalRenovatePr(["pnpm-lock.yaml"])).toBe(true);
    expect(canUpdateOriginalRenovatePr(["pnpm-workspace.yaml"])).toBe(true);
    expect(canUpdateOriginalRenovatePr(["pnpm-lock.yaml", "pnpm-workspace.yaml"])).toBe(true);
  });

  test("requires a superseding PR for empty or broader fixes", () => {
    expect(canUpdateOriginalRenovatePr([])).toBe(false);
    expect(canUpdateOriginalRenovatePr(["packages/pwa/package.json"])).toBe(false);
    expect(canUpdateOriginalRenovatePr(["pnpm-lock.yaml", "packages/pwa/package.json"])).toBe(
      false,
    );
  });
});
