import { defaultParticipants, createPartyFixture } from "./harness/scenarios";
import { expect, test } from "./harness/trizum.fixture";

test.describe("Settings forms", () => {
  test("returns from party settings after saving", async ({ harness, page }) => {
    const seededParty = await harness.seedJoinedParty({
      fixture: createPartyFixture(),
      memberParticipantId: defaultParticipants.blair.id,
    });
    const updatedPartyName = "Updated weekend trip";

    await harness.navigate(`/party/${seededParty.partyId}/settings`);
    await expect(page.getByRole("heading", { name: "Party Settings" })).toBeVisible();

    const nameField = page.getByLabel("Name", { exact: true });

    await nameField.fill(updatedPartyName);
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Party settings saved!")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/party/${seededParty.partyId}(?:\\?.*)?$`));

    await harness.navigate(`/party/${seededParty.partyId}/settings`);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(updatedPartyName);
  });

  test("returns from user settings after saving", async ({ harness, page }) => {
    const updatedUsername = "Saved Harness User";

    await harness.seedPartyList({
      username: "Harness User",
      phone: "",
    });
    await harness.navigate("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    const usernameField = page.getByLabel("Username");

    await usernameField.fill(updatedUsername);
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Settings saved")).toBeVisible();
    await expect(page).toHaveURL(/\/(?:\?.*)?$/);

    await harness.navigate("/settings");
    await expect(page.getByLabel("Username")).toHaveValue(updatedUsername);
  });
});
