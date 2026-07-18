import { expect, type Locator, type Page } from "@playwright/test";

export class ExpenseDetailPage {
  readonly page: Page;
  readonly backButton: Locator;
  readonly menuButton: Locator;
  readonly editMenuItem: Locator;
  readonly deleteMenuItem: Locator;
  readonly deleteDialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.backButton = page.getByRole("button", { name: "Go Back" });
    this.menuButton = page.getByRole("button", { name: "Menu" });
    this.editMenuItem = page.getByRole("menuitem", { name: "Edit" });
    this.deleteMenuItem = page.getByRole("menuitem", { name: "Delete" });
    this.deleteDialog = page.getByRole("dialog", { name: "Delete expense" });
  }

  heading(title: string) {
    return this.page.getByRole("heading", { name: title });
  }

  async expectLoaded(partyId: string, title: string, amountText: string) {
    await expect(this.page).toHaveURL(new RegExp(`/party/${partyId}/expense/[^/?#]+(?:\\?.*)?$`));
    await expect(this.heading(title)).toBeVisible();
    await expect(this.page.getByText(amountText, { exact: false })).toBeVisible();
  }

  async goBack() {
    await this.backButton.click();
  }

  async openEdit() {
    await this.menuButton.click();
    await this.editMenuItem.click();
  }

  async openDeleteConfirmation() {
    await this.menuButton.click();
    await this.deleteMenuItem.click();
    await expect(this.deleteDialog).toBeVisible();
    await expect(this.deleteDialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  }

  async cancelDelete() {
    await this.deleteDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(this.deleteDialog).toBeHidden();
  }

  async confirmDelete() {
    await this.deleteDialog.getByRole("button", { name: "Delete expense" }).click();
  }
}
