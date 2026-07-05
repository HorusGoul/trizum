import { expect, test } from "./harness/trizum.fixture";
import { JoinTrizumPage } from "./pages/join-trizum.page";

test.describe("Join trizum form", () => {
  test("keeps the entered invite when validation fails", async ({ harness, page }) => {
    const joinPage = new JoinTrizumPage(page);
    const invalidInvite = "not-a-party-code";

    await harness.goto("/join");
    await joinPage.expectLoaded();
    await joinPage.codeField.fill(invalidInvite);
    await joinPage.codeField.evaluate((input: HTMLInputElement) => input.form?.requestSubmit());

    await expect(page).toHaveURL(/\/join(?:\?.*)?$/);
    await expect(joinPage.codeField).toHaveValue(invalidInvite);
    await expect(page.getByText("Invalid trizum party code")).toBeVisible();
  });
});
