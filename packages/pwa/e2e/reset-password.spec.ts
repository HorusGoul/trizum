import { expect, test } from "./harness/trizum.fixture";

test.describe("Reset password form", () => {
  test("keeps the entered password when validation fails", async ({ harness, page }) => {
    const invalidPassword = "short";

    await harness.goto("/reset-password?token=test-token");
    await expect(page.getByRole("heading", { name: "Reset password" })).toBeVisible();

    const passwordField = page.getByLabel("New password");

    await passwordField.fill(invalidPassword);
    await page.getByRole("button", { name: "Update password" }).click();

    await expect(page).toHaveURL(/\/reset-password\?(?:.*&)?token=test-token(?:&.*)?$/);
    await expect(passwordField).toHaveValue(invalidPassword);
    await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();
  });
});
