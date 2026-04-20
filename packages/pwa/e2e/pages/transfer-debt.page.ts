import { expect, type Locator, type Page } from "@playwright/test";

export class TransferDebtPage {
  readonly page: Page;
  readonly partyStep: Locator;
  readonly participantStep: Locator;
  readonly confirmationStep: Locator;
  readonly continueButton: Locator;
  readonly confirmTransferButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.partyStep = page.getByTestId("transfer-debt-party-step");
    this.participantStep = page.getByTestId("transfer-debt-participant-step");
    this.confirmationStep = page.getByTestId("transfer-debt-confirmation-step");
    this.continueButton = page.getByRole("button", {
      name: "Continue",
    });
    this.confirmTransferButton = page.getByRole("button", {
      name: "Confirm transfer",
    });
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/party\/[^/]+\/transfer-debt\?.+/);
    await expect(
      this.page.getByRole("heading", { exact: true, name: "Transfer debt" }),
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
    await this.partyStep
      .locator("button")
      .filter({ hasText: partyName })
      .first()
      .click();
    await expect(this.participantStep).toBeVisible();
  }

  async expectParticipantStep() {
    await expect(this.participantStep).toBeVisible();
    await expect(this.page.getByText("Choose who receives it")).toBeVisible();
  }

  async expectRecommendedParticipant(participantName: string) {
    await expect(
      this.participantStep.locator("button").filter({ hasText: participantName }),
    ).toContainText("Recommended");
  }

  async chooseParticipant(participantName: string) {
    await this.participantStep
      .locator("button")
      .filter({ hasText: participantName })
      .first()
      .click();
  }

  async completeTransfer() {
    await expect(this.continueButton).toBeVisible();
    await this.continueButton.click();
    await expect(this.confirmationStep).toBeVisible();
    await expect(
      this.page.getByText("This will settle the debt", { exact: false }),
    ).toBeVisible();
    await this.confirmTransferButton.click();
  }
}
