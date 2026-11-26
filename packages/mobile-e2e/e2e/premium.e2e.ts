import { describe, test } from "@e2e-dev/mobile";
import { expect } from "e2e";

describe("premium", () => {
  test("a signed-out user is sent to sign in from the Premium settings", async ({
    app,
    screen,
  }) => {
    await app.clearState();

    await screen.getByLabel("Profile and app menu").tap({ timeout: 20_000 });
    await screen.getByRole("menuitem", "Settings").tap();
    await screen.scrollUntilVisible(screen.getByRole("button", "Sign in to get Premium"));
    await screen.getByRole("button", "Sign in to get Premium").tap();

    await expect(screen.getByText("Sign in to trizum cloud")).toBeVisible();
    await expect(screen.getByRole("button", "Continue with Apple")).toBeVisible();

    await screen.getByRole("button", "Close sign-in").tap();
    await expect(screen.getByText("Sign in to trizum cloud")).toBeHidden();
  });
});
