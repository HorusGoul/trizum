import { describe, test } from "@e2e-dev/mobile";
import { expect } from "e2e";

describe("home", () => {
  test("a fresh install shows the empty-state actions", async ({ app, screen }) => {
    await app.clearState();

    await expect(screen.getByText("Split expenses, stay even.")).toBeVisible({
      timeout: 20_000,
    });
    await expect(screen.getByRole("link", "Create a Party")).toBeVisible();
    await expect(screen.getByRole("link", "Join with a code")).toBeVisible();
  });
});
