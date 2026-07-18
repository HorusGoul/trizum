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

  test("requires confirmation before deleting an expense", async ({ harness, page }) => {
    const partyPage = new PartyPage(page);
    const expenseDetailPage = new ExpenseDetailPage(page);
    const title = createExpenseLogTitle(0);
    const seededAmountText = formatAmountText(expenseLogJourney.seededExpenseAmountCents / 100);

    const seededParty = await harness.seedJoinedParty({
      fixture: createExpenseLogFixture(1),
      memberParticipantId: expenseLogJourney.memberParticipantId,
    });

    await harness.navigate(`/party/${seededParty.partyId}?tab=expenses`);
    await partyPage.openExpenseInLog(title);
    await expenseDetailPage.expectLoaded(seededParty.partyId, title, seededAmountText);

    await test.step("keep the expense when deletion is canceled", async () => {
      await expenseDetailPage.openDeleteConfirmation();
      await expenseDetailPage.cancelDelete();
      await expenseDetailPage.expectLoaded(seededParty.partyId, title, seededAmountText);
    });

    await test.step("delete the expense only after confirmation", async () => {
      await expenseDetailPage.openDeleteConfirmation();
      await expenseDetailPage.confirmDelete();

      await partyPage.expectLoaded(seededParty.partyId, "Weekend trip");
      await expect(partyPage.expenseRow(title)).toHaveCount(0);
      await expect(page.getByText("Expense deleted")).toBeVisible();
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

  test("keeps gallery controls available while an attachment is loading", async ({
    harness,
    page,
  }) => {
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
    await expect(page.getByRole("button", { name: "View photo" })).toHaveCount(2);

    await page.evaluate(() => {
      window.Image = class PendingImage {
        onerror: null = null;
        onload: null = null;

        set src(_src: string) {}
      } as unknown as typeof Image;
    });

    await page.getByRole("button", { name: "View photo" }).nth(1).click();

    await expect(page).toHaveURL(/\?media=1$/);
    await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
    await expect(page.locator("[data-media-gallery-image]")).toHaveCount(0);

    await page.getByRole("button", { name: "Previous" }).click();
    await expect(page).toHaveURL(/\?media=0$/);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page).toHaveURL(/\?media=1$/);
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page).not.toHaveURL(/[?&]media=/);
  });

  test("restores the gallery backdrop after closing with a drag gesture", async ({
    harness,
    page,
  }) => {
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

    await page.locator('input[aria-label="Upload photo"]').setInputFiles("public/pwa-192x192.png");

    const attachmentButton = page.getByRole("button", { name: "View photo" });
    await attachmentButton.click();

    const overlay = page.locator("[data-media-gallery-overlay]");
    const image = page.locator("[data-media-gallery-image]");
    const slowExitAnimation = await page.addStyleTag({
      content: `
        [data-media-gallery-overlay][data-exiting] {
          animation-duration: 1s !important;
        }
      `,
    });
    await expect(overlay).toHaveCSS("background-color", "rgba(0, 0, 0, 0.25)");
    await expect(image).toBeVisible();

    const imageBox = await image.boundingBox();
    if (!imageBox) {
      throw new Error("Expected the gallery image to have a bounding box");
    }

    const centerX = imageBox.x + imageBox.width / 2;
    const centerY = imageBox.y + imageBox.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX, centerY + 200, { steps: 10 });
    await page.mouse.up();

    await expect(page).not.toHaveURL(/[?&]media=/);
    await expect(overlay).toHaveAttribute("data-exiting", "true");
    await expect(overlay).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

    await attachmentButton.evaluate((element) => (element as HTMLElement).click());

    await expect(page).toHaveURL(/\?media=0$/);
    await expect(overlay).toHaveCSS("background-color", "rgba(0, 0, 0, 0.25)");
    await slowExitAnimation.evaluate((element) => element.parentNode?.removeChild(element));

    await page.getByRole("button", { name: "Close" }).click();
    await expect(overlay).toBeHidden();
    await attachmentButton.click();

    await expect(page).toHaveURL(/\?media=0$/);
    await expect(overlay).toHaveCSS("background-color", "rgba(0, 0, 0, 0.25)");
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
