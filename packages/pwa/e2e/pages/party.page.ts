import { expect, type Locator, type Page } from "@playwright/test";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface SettlementAction {
  actionLabel: "Pay" | "Mark as paid";
  fromLabel: string;
  toLabel: string;
}

export class PartyPage {
  readonly page: Page;
  readonly addExpenseFab: Locator;
  readonly balancesTab: Locator;
  readonly expenseLogPanel: Locator;
  readonly balanceGuidanceHeading: Locator;
  readonly debtFreeMessage: Locator;
  readonly nobodyOwesYouMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addExpenseFab = page.getByRole("button", {
      name: /Add an expense|Add or create/,
    });
    this.balancesTab = page.getByRole("tab", { name: "Balances" });
    this.expenseLogPanel = page.getByRole("tabpanel").first();
    this.balanceGuidanceHeading = page.getByRole("heading", {
      name: "How should I balance?",
    });
    this.debtFreeMessage = page.getByText("You're debt free!");
    this.nobodyOwesYouMessage = page.getByText("Nobody owes you money!");
  }

  heading(name: string | RegExp) {
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
    await expect(
      this.heading(new RegExp(escapeRegExp(partyName))),
    ).toBeVisible();
    await expect(this.addExpenseFab).toBeVisible();
  }

  async openAddExpense() {
    await this.addExpenseFab.click();

    const addExpenseMenuItem = this.page.getByRole("menuitem", {
      name: "Add an expense",
    });

    if (await addExpenseMenuItem.isVisible()) {
      await addExpenseMenuItem.click();
    }
  }

  async expectExpenseInLog(title: string, amountText: string) {
    const row = this.expenseRow(title);

    await expect(row).toBeVisible();
    await expect(row).toContainText(amountText);
  }

  async openExpenseInLog(title: string) {
    await this.expenseRow(title).click();
  }

  async expectVisibleExpensesInOrder(titles: string[]) {
    let previousTop = Number.NEGATIVE_INFINITY;

    for (const title of titles) {
      const row = this.expenseRow(title);
      await expect(row).toBeVisible();
      const box = await row.boundingBox();

      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThan(previousTop);
      previousTop = box!.y;
    }
  }

  async scrollExpenseLogUntilVisible(title: string, maxAttempts = 6) {
    const row = this.expenseRow(title);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (await row.isVisible()) {
        return;
      }

      await this.expenseLogPanel.evaluate((panel) => {
        panel.scrollTop = panel.scrollHeight;
      });

      try {
        await expect(row).toBeVisible({ timeout: 1_500 });
        return;
      } catch {
        continue;
      }
    }

    await expect(row).toBeVisible();
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
