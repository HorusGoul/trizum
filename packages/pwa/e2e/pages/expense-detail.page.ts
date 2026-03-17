import { expect, type Locator, type Page } from "@playwright/test";

export class ExpenseDetailPage {
  readonly page: Page;
  readonly backButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.backButton = page.getByRole("button", { name: "Go Back" });
  }

  heading(title: string) {
    return this.page.getByRole("heading", { name: title });
  }

  async expectLoaded(partyId: string, title: string, amountText: string) {
    await expect(this.page).toHaveURL(
      new RegExp(`/party/${partyId}/expense/[^/?#]+(?:\\?.*)?$`),
    );
    await expect(this.heading(title)).toBeVisible();
    await expect(this.page.getByText(amountText, { exact: false })).toBeVisible();
  }

  async goBack() {
    await this.backButton.click();
  }
}
