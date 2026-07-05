import { expect, type Locator, type Page } from "@playwright/test";

export class ExpenseEditorPage {
  readonly page: Page;
  readonly addHeading: Locator;
  readonly titleField: Locator;
  readonly amountField: Locator;
  readonly saveButton: Locator;
  readonly backButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addHeading = page.getByRole("heading", { name: "New expense" });
    this.titleField = page.getByLabel("Title");
    this.amountField = page.getByLabel("Amount");
    this.saveButton = page.getByRole("button", { name: "Save" });
    this.backButton = page.getByRole("button", { name: "Go Back" });
  }

  participantCheckbox(name: string) {
    return this.page.getByRole("checkbox", { name });
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/party\/.+\/add(?:\?.*)?$/);
    await expect(this.addHeading).toBeVisible();
  }

  async expectEditLoaded(partyId: string, expenseTitle: string) {
    await expect(this.page).toHaveURL(
      new RegExp(`/party/${partyId}/expense/[^/?#]+/edit(?:\\?.*)?$`),
    );
    await expect(this.page.getByRole("heading", { name: `Editing ${expenseTitle}` })).toBeVisible();
  }

  async fillTitle(title: string) {
    await this.titleField.fill(title);
  }

  async fillAmount(amount: number) {
    await this.amountField.fill(amount.toFixed(2));
  }

  async setParticipantIncluded(name: string, included: boolean) {
    const checkbox = this.participantCheckbox(name);
    const isSelected = await checkbox.isChecked();

    if (isSelected !== included) {
      await checkbox.setChecked(included, { force: true });
    }

    if (included) {
      await expect(checkbox).toBeChecked();
      return;
    }

    await expect(checkbox).not.toBeChecked();
  }

  async save() {
    await this.saveButton.click();
  }

  async goBack() {
    await this.backButton.click();
  }
}
