import { expect, type Locator, type Page } from "@playwright/test";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class PartyPage {
  readonly page: Page;
  readonly addExpenseButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addExpenseButton = page.getByRole("button", { name: "Add an expense" });
  }

  heading(name: string) {
    return this.page.getByRole("heading", { name });
  }

  expenseRow(title: string) {
    return this.page.getByRole("link", {
      name: new RegExp(escapeRegExp(title)),
    });
  }

  async expectLoaded(partyId: string, partyName: string) {
    await expect(this.page).toHaveURL(
      new RegExp(`/party/${partyId}(?:\\?.*)?$`),
    );
    await expect(this.heading(partyName)).toBeVisible();
    await expect(this.addExpenseButton).toBeVisible();
  }

  async openAddExpense() {
    await this.addExpenseButton.click();
  }

  async expectExpenseInLog(title: string, amountText: string) {
    const row = this.expenseRow(title);

    await expect(row).toBeVisible();
    await expect(row).toContainText(amountText);
  }
}
