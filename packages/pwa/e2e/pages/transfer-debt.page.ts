import { expect, type Locator, type Page } from "@playwright/test";

export class TransferDebtPage {
  readonly page: Page;
  readonly transferDebtButton: Locator;
  readonly destinationPartySelect: Locator;
  readonly recommendationsSection: Locator;

  constructor(page: Page) {
    this.page = page;
    this.transferDebtButton = page.getByRole("button", {
      name: "Transfer debt",
    });
    this.destinationPartySelect = page.getByRole("button", {
      name: "Destination party",
    });
    this.recommendationsSection = page
      .locator("div.rounded-xl")
      .filter({ hasText: "Recommendations" });
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/party\/[^/]+\/transfer-debt\?.+/);
    await expect(
      this.page.getByRole("heading", { exact: true, name: "Transfer debt" }),
    ).toBeVisible();
    await expect(this.destinationPartySelect).toBeVisible();
    await expect(this.transferDebtButton).toBeVisible();
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
    await this.destinationPartySelect.click();
    await this.page.getByRole("option", { name: partyName }).click();
  }

  async expectRecommendation(participantName: string) {
    await expect(
      this.recommendationsSection.getByRole("button", { name: participantName }),
    ).toBeVisible();
  }

  async chooseRecommendation(participantName: string) {
    await this.recommendationsSection
      .getByRole("button", { name: participantName })
      .click();
  }

  async completeTransfer() {
    await this.transferDebtButton.click();
  }
}
