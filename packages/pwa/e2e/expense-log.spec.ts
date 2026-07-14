import { ExpenseDetailPage } from "./pages/expense-detail.page";
import { ExpenseEditorPage } from "./pages/expense-editor.page";
import { PartyPage } from "./pages/party.page";
import {
  createImbalancedPartyFixture,
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
    const seededAmountText = formatAmountText(expenseLogJourney.seededExpenseAmountCents / 100);
    const newestTitle = createExpenseLogTitle(expenseLogJourney.expenseCount - 1);
    const secondNewestTitle = createExpenseLogTitle(expenseLogJourney.expenseCount - 2);
    const thirdNewestTitle = createExpenseLogTitle(expenseLogJourney.expenseCount - 3);
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
      await expenseDetailPage.expectLoaded(seededParty.partyId, oldestTitle, seededAmountText);
    });
  });

  test("returns a newly added expense to the top of the log", async ({ harness, page }) => {
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
      await partyPage.expectExpenseInLog(expenseLogJourney.newExpenseTitle, expectedAmountText);
    });
  });

  test("returns to the expense log after editing an expense and going back once", async ({
    harness,
    page,
  }) => {
    const partyPage = new PartyPage(page);
    const expenseEditorPage = new ExpenseEditorPage(page);
    const expenseDetailPage = new ExpenseDetailPage(page);
    const originalTitle = "Cabin groceries";
    const updatedTitle = "Cabin grocery run";
    const seededAmountText = formatAmountText(90);

    const seededParty = await harness.joinSeededParty({
      fixture: createImbalancedPartyFixture(),
      participantName: defaultParticipants.blair.name,
    });

    await test.step("open an existing expense and edit it from the detail menu", async () => {
      await partyPage.expectLoaded(seededParty.partyId, "Weekend trip");
      await partyPage.openExpenseInLog(originalTitle);
      await expenseDetailPage.expectLoaded(seededParty.partyId, originalTitle, seededAmountText);

      await expenseDetailPage.openEdit();
      await expenseEditorPage.expectEditLoaded(seededParty.partyId, originalTitle);
      await expenseEditorPage.fillTitle(updatedTitle);
      await expenseEditorPage.save();

      await expenseDetailPage.expectLoaded(seededParty.partyId, updatedTitle, seededAmountText);
    });

    await test.step("go back once to the expense log", async () => {
      await expenseDetailPage.goBack();

      await partyPage.expectLoaded(seededParty.partyId, "Weekend trip");
      await partyPage.expectExpenseInLog(updatedTitle, seededAmountText);
    });
  });

  test("returns to expense detail when backing out of edit", async ({ harness, page }) => {
    const partyPage = new PartyPage(page);
    const expenseEditorPage = new ExpenseEditorPage(page);
    const expenseDetailPage = new ExpenseDetailPage(page);
    const title = "Cabin groceries";
    const seededAmountText = formatAmountText(90);

    const seededParty = await harness.joinSeededParty({
      fixture: createImbalancedPartyFixture(),
      participantName: defaultParticipants.blair.name,
    });

    await partyPage.expectLoaded(seededParty.partyId, "Weekend trip");
    await partyPage.openExpenseInLog(title);
    await expenseDetailPage.expectLoaded(seededParty.partyId, title, seededAmountText);

    await expenseDetailPage.openEdit();
    await expenseEditorPage.expectEditLoaded(seededParty.partyId, title);
    await expenseEditorPage.goBack();

    await expenseDetailPage.expectLoaded(seededParty.partyId, title, seededAmountText);
  });

  test("opens the selected attachment on the first gallery render", async ({ harness, page }) => {
    const partyPage = new PartyPage(page);
    const expenseEditorPage = new ExpenseEditorPage(page);
    const expenseDetailPage = new ExpenseDetailPage(page);
    const title = "Cabin groceries";
    const seededAmountText = formatAmountText(90);

    const seededParty = await harness.joinSeededParty({
      fixture: createImbalancedPartyFixture(),
      participantName: defaultParticipants.blair.name,
    });

    await partyPage.openExpenseInLog(title);
    await expenseDetailPage.expectLoaded(seededParty.partyId, title, seededAmountText);
    await expenseDetailPage.openEdit();
    await expenseEditorPage.expectEditLoaded(seededParty.partyId, title);

    await page
      .locator('input[aria-label="Upload photo"]')
      .setInputFiles(["public/pwa-64x64.png", "public/pwa-192x192.png"]);

    const attachmentButtons = page.getByRole("button", { name: "View photo" });
    await expect(attachmentButtons).toHaveCount(2);
    await attachmentButtons.nth(1).click();

    await expect(page).toHaveURL(/\?media=1$/);
    await expect(page.locator("[data-media-gallery-image]")).toHaveJSProperty("naturalWidth", 192);
  });

  test("keeps expense draft values when validation fails", async ({ harness, page }) => {
    const partyPage = new PartyPage(page);
    const expenseEditorPage = new ExpenseEditorPage(page);
    const draftAmount = 12.34;

    const seededParty = await harness.seedJoinedParty({
      fixture: createExpenseLogFixture(1),
      memberParticipantId: defaultParticipants.blair.id,
    });

    await harness.navigate(`/party/${seededParty.partyId}?tab=expenses`);
    await partyPage.expectLoaded(seededParty.partyId, "Weekend trip");
    await partyPage.openAddExpense();

    await expenseEditorPage.expectLoaded();
    await expenseEditorPage.fillAmount(draftAmount);
    await expenseEditorPage.save();

    await expect(page).toHaveURL(new RegExp(`/party/${seededParty.partyId}/add(?:\\?.*)?$`));
    await expect(expenseEditorPage.amountField).toHaveValue(draftAmount.toFixed(2));
    await expect(page.getByText("Title is required")).toBeVisible();
  });
});
