import { expect, type Locator, type Page } from "@playwright/test";

export class JoinTrizumPage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Join a trizum" });
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/join(?:\?.*)?$/);
    await expect(this.heading).toBeVisible();
  }
}
