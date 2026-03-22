import { ExpenseDetailPage } from "./pages/expense-detail.page";
import { ExpenseEditorPage } from "./pages/expense-editor.page";
import { PartyPage } from "./pages/party.page";
import {
  createExpenseLogFixture,
  createExpenseLogTitle,
  defaultParticipants,
  expenseEntryJourney,
  expenseLogJourney,
} from "./harness/scenarios";
import { expect, test } from "./harness/trizum.fixture";

function formatAmountText(amount: number) {
  return amount.toFixed(2).replace(".", ",");
}

test.describe("Expense log", () => {
  test("renders newest expenses first and paginates into older chunks @slow", async ({
    harness,
    page,
  }) => {
    test.slow();

    const partyPage = new PartyPage(page);
    const expenseDetailPage = new ExpenseDetailPage(page);
    const seededAmountText = formatAmountText(
      expenseLogJourney.seededExpenseAmountCents / 100,
    );
    const newestTitle = createExpenseLogTitle(
      expenseLogJourney.expenseCount - 1,
    );
    const secondNewestTitle = createExpenseLogTitle(
      expenseLogJourney.expenseCount - 2,
    );
    const thirdNewestTitle = createExpenseLogTitle(
      expenseLogJourney.expenseCount - 3,
    );
    const oldestTitle = createExpenseLogTitle(0);

    const seededParty =
      await test.step("seed a party with enough expenses to span multiple chunks", async () =>
        harness.seedJoinedParty({
          fixture: createExpenseLogFixture(),
          memberParticipantId: expenseLogJourney.memberParticipantId,
        }));

    await test.step("show the newest expenses at the top of the log", async () => {
      await harness.navigate(`/party/${seededParty.partyId}?tab=expenses`);
      await partyPage.expectLoaded(seededParty.partyId, "Weekend trip");
      await partyPage.expectVisibleExpensesInOrder([
        newestTitle,
        secondNewestTitle,
        thirdNewestTitle,
      ]);
    });

    await test.step("scroll until an older expense from the previous chunk is visible", async () => {
      await partyPage.scrollExpenseLogUntilVisible(oldestTitle);
      await partyPage.expectExpenseInLog(oldestTitle, seededAmountText);
    });

    await test.step("open the oldest expense from the log", async () => {
      await partyPage.openExpenseInLog(oldestTitle);
      await expenseDetailPage.expectLoaded(
        seededParty.partyId,
        oldestTitle,
        seededAmountText,
      );
    });
  });

  test("returns a newly added expense to the top of the log", async ({
    harness,
    page,
  }) => {
    const partyPage = new PartyPage(page);
    const expenseEditorPage = new ExpenseEditorPage(page);
    const expenseDetailPage = new ExpenseDetailPage(page);
    const expectedAmountText = formatAmountText(expenseEntryJourney.amount);

    const seededParty = await harness.seedJoinedParty({
      fixture: createExpenseLogFixture(2),
      memberParticipantId: defaultParticipants.blair.id,
    });

    await test.step("create a new expense from the expense log", async () => {
      await harness.navigate(`/party/${seededParty.partyId}?tab=expenses`);
      await partyPage.expectLoaded(seededParty.partyId, "Weekend trip");
      await partyPage.openAddExpense();

      await expenseEditorPage.expectLoaded();
      await expenseEditorPage.fillTitle(expenseLogJourney.newExpenseTitle);
      await expenseEditorPage.fillAmount(expenseEntryJourney.amount);

      for (const participantName of expenseEntryJourney.participantNames) {
        await expenseEditorPage.setParticipantIncluded(participantName, true);
      }

      await expenseEditorPage.save();
      await expenseDetailPage.expectLoaded(
        seededParty.partyId,
        expenseLogJourney.newExpenseTitle,
        expectedAmountText,
      );
      await expenseDetailPage.goBack();
    });

    await test.step("show the new expense above the seeded older entries", async () => {
      await partyPage.expectLoaded(seededParty.partyId, "Weekend trip");
      await partyPage.expectVisibleExpensesInOrder([
        expenseLogJourney.newExpenseTitle,
        createExpenseLogTitle(1),
        createExpenseLogTitle(0),
      ]);
      await partyPage.expectExpenseInLog(
        expenseLogJourney.newExpenseTitle,
        expectedAmountText,
      );
    });
  });
});
