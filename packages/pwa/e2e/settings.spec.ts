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

  test("keeps party settings draft values when validation fails", async ({ harness, page }) => {
    const seededParty = await harness.seedJoinedParty({
      fixture: createPartyFixture(),
      memberParticipantId: defaultParticipants.blair.id,
    });
    const draftDescription = "Keep this description after a failed save";

    await harness.navigate(`/party/${seededParty.partyId}/settings`);
    await expect(page.getByRole("heading", { name: "Party Settings" })).toBeVisible();

    const nameField = page.getByLabel("Name", { exact: true });
    const descriptionField = page.getByLabel("Description");

    await descriptionField.fill(draftDescription);
    await nameField.fill("");
    await nameField.evaluate((input: HTMLInputElement) => input.form?.requestSubmit());

    await expect(page).toHaveURL(new RegExp(`/party/${seededParty.partyId}/settings(?:\\?.*)?$`));
    await expect(descriptionField).toHaveValue(draftDescription);
    await expect(page.getByText("Title is required")).toBeVisible();
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

  test("keeps user settings draft values when validation fails", async ({ harness, page }) => {
    const draftPhoneNumber = "612345678";

    await harness.seedPartyList({
      username: "Harness User",
      phone: "",
    });
    await harness.navigate("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    const usernameField = page.getByLabel("Username");
    const phoneField = page.getByLabel("Phone number");

    await phoneField.fill(draftPhoneNumber);
    await usernameField.fill("");
    await usernameField.evaluate((input: HTMLInputElement) => input.form?.requestSubmit());

    await expect(page).toHaveURL(/\/settings(?:\?.*)?$/);
    await expect(phoneField).toHaveValue(draftPhoneNumber);
    await expect(page.getByText("A name for the participant is required")).toBeVisible();
  });
});
