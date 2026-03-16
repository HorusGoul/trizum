import { expect, type Locator, type Page } from "@playwright/test";

export class NewTrizumPage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "New trizum" });
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/new$/);
    await expect(this.heading).toBeVisible();
  }
}
