import { expect, type Locator, type Page } from "@playwright/test";

export class HomePage {
  readonly page: Page;
  readonly welcomeHeading: Locator;
  readonly createPartyLink: Locator;
  readonly joinPartyLink: Locator;
  readonly migrateFromTricountLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeHeading = page.getByRole("heading", {
      name: "Welcome to trizum",
    });
    this.createPartyLink = page.getByRole("link", {
      name: "Create a new Party",
    });
    this.joinPartyLink = page.getByRole("link", {
      name: "Join a Party",
    });
    this.migrateFromTricountLink = page.getByRole("link", {
      name: "Migrate from Tricount",
    });
  }

  async goto() {
    await this.page.goto("/");
  }

  async expectLoaded() {
    await expect(this.welcomeHeading).toBeVisible();
    await expect(this.createPartyLink).toBeVisible();
    await expect(this.joinPartyLink).toBeVisible();
    await expect(this.migrateFromTricountLink).toBeVisible();
  }

  async openCreateParty() {
    await this.createPartyLink.click();
  }

  async openJoinParty() {
    await this.joinPartyLink.click();
  }
}
