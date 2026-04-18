import { expect, type Locator, type Page } from "@playwright/test";

export class TransferDebtPage {
  readonly page: Page;
  readonly selectionStep: Locator;
  readonly confirmationStep: Locator;
  readonly reviewTransferButton: Locator;
  readonly confirmTransferButton: Locator;
  readonly recommendationsSection: Locator;

  constructor(page: Page) {
    this.page = page;
    this.selectionStep = page.getByTestId("transfer-debt-selection-step");
    this.confirmationStep = page.getByTestId("transfer-debt-confirmation-step");
    this.reviewTransferButton = page.getByRole("button", {
      name: "Review transfer",
    });
    this.confirmTransferButton = page.getByRole("button", {
      name: "Confirm transfer",
    });
    this.recommendationsSection = this.selectionStep
      .locator("div.rounded-3xl")
      .filter({
        has: page.getByText("Quick recommendations", { exact: true }),
      });
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/party\/[^/]+\/transfer-debt\?.+/);
    await expect(
      this.page.getByRole("heading", { exact: true, name: "Transfer debt" }),
    ).toBeVisible();
    await expect(this.selectionStep).toBeVisible();
    await expect(
      this.page.getByText("Choose where the debt should continue"),
    ).toBeVisible();
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

  async chooseDestinationParty(partyName: string) {
    await this.selectionStep
      .locator("button")
      .filter({ hasText: partyName })
      .first()
      .click();
  }

  async expectRecommendation(participantName: string) {
    await expect(
      this.recommendationsSection
        .locator("button")
        .filter({ hasText: participantName })
        .first(),
    ).toBeVisible();
  }

  async chooseRecommendation(participantName: string) {
    await this.recommendationsSection
      .locator("button")
      .filter({ hasText: participantName })
      .first()
      .click();
  }

  async completeTransfer() {
    await expect(this.reviewTransferButton).toBeVisible();
    await this.reviewTransferButton.click();
    await expect(this.confirmationStep).toBeVisible();
    await this.confirmTransferButton.click();
  }
}
