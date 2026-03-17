import { expect, type Locator, type Page } from "@playwright/test";

interface NewPartyDetails {
  name: string;
  participants: [string, ...string[]];
}

export class NewTrizumPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly nameField: Locator;
  readonly participantNames: Locator;
  readonly newParticipantNameField: Locator;
  readonly addParticipantButton: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "New trizum" });
    this.nameField = page.getByRole("textbox", { name: /^Name$/ });
    this.participantNames = page.getByRole("textbox", {
      name: /^Participant name$/,
    });
    this.newParticipantNameField = page.getByRole("textbox", {
      name: /^New participant name$/,
    });
    this.addParticipantButton = page.getByRole("button", {
      name: "Add participant",
    });
    this.saveButton = page.getByRole("button", { name: "Save" });
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/new(?:\?.*)?$/);
    await expect(this.heading).toBeVisible();
  }

  async createParty({ name, participants }: NewPartyDetails) {
    const [creatorName, ...otherParticipants] = participants;

    await this.nameField.fill(name);
    await this.participantNames.first().fill(creatorName);

    for (const participant of otherParticipants) {
      const participantCount = await this.participantNames.count();

      await this.newParticipantNameField.fill(participant);
      await this.addParticipantButton.click();
      await expect(this.participantNames).toHaveCount(participantCount + 1);
    }

    await this.saveButton.click();
  }
}
