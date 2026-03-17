import { expect, type Page } from "@playwright/test";

export class ExpensePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async expectLoaded(expenseName: string) {
    await expect(this.page).toHaveURL(/\/party\/[^/]+\/expense\/[^/]+(?:\?.*)?$/);
    await expect(
      this.page.getByRole("heading", { name: expenseName }),
    ).toBeVisible();
  }
}
