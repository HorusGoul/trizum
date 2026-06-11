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
  readonly expenseLogList: Locator;
  readonly balanceGuidanceHeading: Locator;
  readonly debtFreeMessage: Locator;
  readonly nobodyOwesYouMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addExpenseFab = page.getByRole("button", {
      name: /Add an expense|Add or create/,
    });
    this.balancesTab = page.getByRole("tab", { name: "Balances" });
    this.expenseLogList = page.locator('[data-testid="expense-log-list"]');
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
    await expect(this.page).toHaveURL(new RegExp(`/party/${partyId}(?:\\?.*)?$`));
    await expect(this.heading(new RegExp(escapeRegExp(partyName)))).toBeVisible({
      timeout: 30_000,
    });
    await expect(this.addExpenseFab).toBeVisible({ timeout: 30_000 });
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

    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText(amountText);
  }

  async openExpenseInLog(title: string) {
    await this.expenseRow(title).click();
  }

  async expectVisibleExpensesInOrder(titles: string[]) {
    await expect(async () => {
      let previousTop = Number.NEGATIVE_INFINITY;

      for (const title of titles) {
        const row = this.expenseRow(title);
        await expect(row).toBeVisible({ timeout: 5_000 });
        const top = await row.evaluate((element) => element.getBoundingClientRect().top);

        expect(top).toBeGreaterThan(previousTop);
        previousTop = top;
      }
    }).toPass({ timeout: 30_000 });
  }

  async scrollExpenseLogUntilVisible(title: string, timeoutMs = 120_000) {
    const row = this.expenseRow(title);
    const deadline = Date.now() + timeoutMs;

    await expect(this.expenseLogList).toBeVisible({ timeout: 30_000 });

    while (Date.now() < deadline) {
      if (await row.isVisible()) {
        return;
      }

      const previousScrollHeight = await this.expenseLogList.evaluate((list) => list.scrollHeight);

      await this.expenseLogList.evaluate((list) => {
        list.scrollTop = list.scrollHeight;
      });

      try {
        await expect
          .poll(
            async () => {
              if (await row.isVisible()) {
                return "target";
              }

              const scrollHeight = await this.expenseLogList.evaluate((list) => list.scrollHeight);

              return scrollHeight > previousScrollHeight ? "advanced" : "waiting";
            },
            {
              intervals: [250, 500, 1_000],
              timeout: Math.max(1_000, Math.min(10_000, deadline - Date.now())),
            },
          )
          .not.toBe("waiting");
      } catch {
        continue;
      }
    }

    await expect(row).toBeVisible({ timeout: 1_000 });
  }

  async openBalances() {
    await this.balancesTab.click();
    await expect(this.page).toHaveURL(/\/party\/[^?]+\?tab=balances(?:&.*)?$/);
  }

  async expectSettlementActionVisible(action: SettlementAction) {
    const actionCard = this.settlementActionCard(action);

    await expect(this.balanceGuidanceHeading).toBeVisible();
    await expect(actionCard).toBeVisible();
    await expect(actionCard.getByRole("button", { name: action.actionLabel })).toBeVisible();
  }

  async expectSettlementActionButtonVisible(action: SettlementAction, buttonName: string) {
    await expect(
      this.settlementActionCard(action).getByRole("button", {
        name: buttonName,
      }),
    ).toBeVisible();
  }

  async expectSettlementActionButtonHidden(action: SettlementAction, buttonName: string) {
    await expect(
      this.settlementActionCard(action).getByRole("button", {
        name: buttonName,
      }),
    ).toHaveCount(0);
  }

  async openSettlementAction(action: SettlementAction) {
    await this.settlementActionCard(action)
      .getByRole("button", { name: action.actionLabel })
      .click();
  }

  async openSettlementActionButton(action: SettlementAction, buttonName: string) {
    await this.settlementActionCard(action).getByRole("button", { name: buttonName }).click();
  }

  async expectSettlementActionRemoved(action: SettlementAction) {
    await expect(this.settlementActionCard(action)).toHaveCount(0);
  }

  async expectFullySettled() {
    await expect(this.balanceGuidanceHeading).toHaveCount(0);
    await expect(this.debtFreeMessage).toBeVisible();
    await expect(this.nobodyOwesYouMessage).toBeVisible();
    await expect(
      this.page.getByRole("button", {
        name: /^(Pay|Mark as paid|Transfer to another party)$/,
      }),
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
