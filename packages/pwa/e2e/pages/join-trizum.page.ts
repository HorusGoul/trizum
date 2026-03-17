import { expect, type Locator, type Page } from "@playwright/test";

export class JoinTrizumPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly codeField: Locator;
  readonly joinButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Join a trizum" });
    this.codeField = page.getByLabel("Link or code");
    this.joinButton = page.getByRole("button", { name: "Join" });
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/join(?:\?.*)?$/);
    await expect(this.heading).toBeVisible();
  }

  async joinWithLinkOrCode(value: string) {
    await this.codeField.fill(value);
    await this.joinButton.click();
  }

  async joinWithCode(code: string) {
    await this.joinWithLinkOrCode(code);
  }
}
