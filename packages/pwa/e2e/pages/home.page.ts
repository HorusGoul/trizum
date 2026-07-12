import { expect, type Locator, type Page } from "@playwright/test";

export class HomePage {
  readonly page: Page;
  readonly welcomeHeading: Locator;
  readonly createPartyLink: Locator;
  readonly cloudSyncLink: Locator;
  readonly joinPartyLink: Locator;
  readonly migrateFromTricountLink: Locator;
  readonly menuButton: Locator;
  readonly archivedPartiesMenuItem: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeHeading = page.getByRole("heading", {
      name: "Split expenses, stay even.",
    });
    this.createPartyLink = page.getByRole("link", {
      name: "Create a Party",
    });
    this.cloudSyncLink = page.getByRole("link", {
      name: /Keep every party in sync/,
    });
    this.joinPartyLink = page.getByRole("link", {
      name: "Join with a code",
    });
    this.migrateFromTricountLink = page.getByRole("link", {
      name: "Import from Tricount",
    });
    this.menuButton = page.getByRole("button", {
      name: "Profile and app menu",
    });
    this.archivedPartiesMenuItem = page.getByRole("menuitem", {
      name: "Archived parties",
    });
  }

  async goto() {
    await this.page.goto("/");
  }

  async expectLoaded() {
    await expect(this.welcomeHeading).toBeVisible();
    await expect(this.createPartyLink).toBeVisible();
    await expect(this.cloudSyncLink).toBeVisible();
    await expect(this.joinPartyLink).toBeVisible();
    await expect(this.migrateFromTricountLink).toBeVisible();
  }

  async openCreateParty() {
    await this.createPartyLink.click();
  }

  async openJoinParty() {
    await this.joinPartyLink.click();
  }

  async openCloudSync() {
    await this.cloudSyncLink.click();
  }

  async openArchivedParties() {
    await this.menuButton.click();
    await this.archivedPartiesMenuItem.click();
  }

  partyLink(name: string | RegExp) {
    return this.page.getByRole("link", { name });
  }

  partyCard(name: string | RegExp) {
    return this.page.locator('[data-testid="party-list-card"]').filter({ hasText: name });
  }

  async expectPartyVisible(name: string | RegExp) {
    await expect(this.partyCard(name)).toBeVisible();
  }

  async openParty(name: string | RegExp) {
    await this.partyCard(name).click();
  }
}
