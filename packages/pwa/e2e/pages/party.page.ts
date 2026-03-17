import { expect, type Locator, type Page } from "@playwright/test";

interface SettlementAction {
  actionLabel: "Pay" | "Mark as paid";
  fromLabel: string;
  toLabel: string;
}

export class PartyPage {
  readonly page: Page;
  readonly balancesTab: Locator;
  readonly balanceGuidanceHeading: Locator;
  readonly debtFreeMessage: Locator;
  readonly nobodyOwesYouMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.balancesTab = page.getByRole("tab", { name: "Balances" });
    this.balanceGuidanceHeading = page.getByRole("heading", {
      name: "How should I balance?",
    });
    this.debtFreeMessage = page.getByText("You're debt free!");
    this.nobodyOwesYouMessage = page.getByText("Nobody owes you money!");
  }

  async openBalances() {
    await this.balancesTab.click();
    await expect(this.page).toHaveURL(/\/party\/[^?]+\?tab=balances(?:&.*)?$/);
  }

  async expectSettlementActionVisible(action: SettlementAction) {
    const actionCard = this.settlementActionCard(action);

    await expect(this.balanceGuidanceHeading).toBeVisible();
    await expect(actionCard).toBeVisible();
    await expect(
      actionCard.getByRole("button", { name: action.actionLabel }),
    ).toBeVisible();
  }

  async openSettlementAction(action: SettlementAction) {
    await this.settlementActionCard(action)
      .getByRole("button", { name: action.actionLabel })
      .click();
  }

  async expectSettlementActionRemoved(action: SettlementAction) {
    await expect(this.settlementActionCard(action)).toHaveCount(0);
  }

  async expectFullySettled() {
    await expect(this.balanceGuidanceHeading).toHaveCount(0);
    await expect(this.debtFreeMessage).toBeVisible();
    await expect(this.nobodyOwesYouMessage).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: /^(Pay|Mark as paid)$/ }),
    ).toHaveCount(0);
  }

  private settlementActionCard(action: SettlementAction) {
    return this.page
      .locator("div.rounded-xl")
      .filter({ hasText: action.fromLabel })
      .filter({ hasText: action.toLabel })
      .filter({
        has: this.page.getByRole("button", { name: action.actionLabel }),
      });
  }
}
