import { expect, type Locator, type Page } from "@playwright/test";

export class WhoAreYouPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Who are you?" });
    this.saveButton = page.getByRole("button", { name: /save|guardar/i });
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/party\/[^/]+\/who(?:\?.*)?$/);
    await expect(this.heading).toBeVisible();
  }

  participantOption(name: string) {
    return this.page.getByRole("radio", { name });
  }

  async selectParticipant(name: string) {
    await this.participantOption(name).click({ force: true });
    await this.saveButton.click();
  }
}
