import { expect, type Locator, type Page } from "@playwright/test";

export class PayPage {
  readonly page: Page;
  readonly markAsPaidButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.markAsPaidButton = page.getByRole("button", { name: "Mark as paid" });
  }

  async expectLoaded(title: "Pay" | "Mark as paid") {
    await expect(this.page).toHaveURL(/\/party\/[^/]+\/pay\?.+/);
    await expect(
      this.page.getByRole("heading", { exact: true, name: title }),
    ).toBeVisible();
    await expect(this.markAsPaidButton).toBeVisible();
  }

  async expectSearchParams(params: {
    amount: string;
    fromId: string;
    toId: string;
  }) {
    await expect
      .poll(() => {
        const url = new URL(this.page.url());
        return {
          amount: url.searchParams.get("amount"),
          fromId: url.searchParams.get("fromId"),
          toId: url.searchParams.get("toId"),
        };
      })
      .toEqual(params);
  }

  async completeSettlement() {
    await this.markAsPaidButton.click();
  }
}
