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
  test("keeps virtualized cards evenly spaced as content and viewport sizes change", async ({
    harness,
    page,
  }) => {
    test.slow();

    const fixture = createExpenseLogFixture(80);

    for (const [index, expense] of fixture.expenses.entries()) {
      if (index % 2 === 0) {
        Object.assign(expense, {
          originalAmount: { amount: 2000, currency: "USD" },
          exchangeRate: 0.617,
        });
      }

      if (index % 5 === 0) expense.name = `Weekend groceries for everyone, purchase ${index}`;
    }

    const { partyId } = await harness.seedJoinedParty({
      fixture,
      memberParticipantId: defaultParticipants.blair.id,
    });

    await page.setViewportSize({ width: 375, height: 844 });
    await harness.navigate(`/party/${partyId}?tab=expenses`);
    const list = page.getByTestId("expense-log-list");
    await expect(list.getByRole("link").first()).toBeVisible();

    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await expect
        .poll(() =>
          list.evaluate((element) => {
            const boxes = [...element.querySelectorAll('a[href*="/expense/"]')].map((card) =>
              card.getBoundingClientRect(),
            );

            return (
              boxes.length > 1 &&
              boxes
                .slice(1)
                .every((box, index) => Math.abs(box.top - boxes[index].bottom - 16) <= 1)
            );
          }),
        )
        .toBe(true);
      expect(await list.getByRole("link").count()).toBeLessThan(fixture.expenses.length);
    }

    const partyPage = new PartyPage(page);
    const oldestTitle = fixture.expenses[0]!.name;
    await partyPage.scrollExpenseLogUntilVisible(oldestTitle);
    await partyPage.openExpenseInLog(oldestTitle);
    const detail = new ExpenseDetailPage(page);
    await expect(detail.heading(oldestTitle)).toBeVisible();
    await detail.goBack();

    await expect(list.getByRole("link", { name: new RegExp(oldestTitle) })).toBeVisible();
  });

  for (const width of [375, 1280]) {
    test(`restores a mixed-height expense in the middle of the list at ${width}px`, async ({
      harness,
      page,
    }) => {
      test.slow();
      const fixture = createExpenseLogFixture(180);

      for (const [index, expense] of fixture.expenses.entries()) {
        if (index % 2 === 0)
          Object.assign(expense, {
            originalAmount: { amount: 2000, currency: "USD" },
            exchangeRate: 0.617,
          });
      }

      const { partyId } = await harness.seedJoinedParty({
        fixture,
        memberParticipantId: defaultParticipants.blair.id,
      });

      await page.setViewportSize({ width, height: 844 });
      await harness.navigate(`/party/${partyId}?tab=expenses`);
      const list = page.getByTestId("expense-log-list");
      await expect(list.getByRole("link").first()).toBeVisible();

      for (let step = 0; step < 12; step++) {
        await list.evaluate((element) => {
          element.scrollTop += 600;
        });
        // Let the virtualizer measure each newly rendered group before scrolling further.
        await expect
          .poll(() =>
            list.evaluate(async (element) => {
              const before = element
                .querySelector('[role="listitem"]')
                ?.getBoundingClientRect().height;

              await new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
              );

              return (
                before ===
                element.querySelector('[role="listitem"]')?.getBoundingClientRect().height
              );
            }),
          )
          .toBe(true);
      }

      const anchor = await list.evaluate((element) => {
        const bounds = element.getBoundingClientRect();

        const visible = [
          ...element.querySelectorAll<HTMLAnchorElement>('a[href*="/expense/"]'),
        ].filter((card) => {
          const box = card.getBoundingClientRect();

          return box.top >= bounds.top && box.bottom <= bounds.bottom;
        });

        const card = visible[Math.floor(visible.length / 2)];

        if (!card) throw new Error("Expected a fully visible expense in the middle of the list");

        return { href: card.getAttribute("href")!, top: card.getBoundingClientRect().top };
      });

      const row = list.locator(`a[href="${anchor.href}"]`);
      await row.click();
      await expect(page).toHaveURL(/\/expense\//);
      await expect(list).toBeHidden();
      await new ExpenseDetailPage(page).goBack();
      await expect(row).toBeInViewport({ ratio: 1 });
      await expect
        .poll(async () => Math.abs((await row.boundingBox())!.y - anchor.top))
        .toBeLessThanOrEqual(1);
    });
  }

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
      window.Image = new Proxy(window.Image, {
        construct(ImageConstructor, args, newTarget) {
          const image = Reflect.construct(ImageConstructor, args, newTarget);
          Object.defineProperty(image, "src", {
            configurable: true,
            set(_src: string) {},
          });

          return image;
        },
      });
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

  test("continues gallery dismissal after release and retains the photo through button close", async ({
    harness,
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const seededParty = await harness.seedJoinedParty({
      fixture: createExpenseLogFixture(1),
      memberParticipantId: defaultParticipants.blair.id,
    });

    await harness.navigate(`/party/${seededParty.partyId}/add`);
    await page.locator('input[aria-label="Upload photo"]').setInputFiles("public/pwa-192x192.png");
    const attachment = page.getByRole("button", { name: "View photo" });
    await attachment.click();
    const image = page.locator("[data-media-gallery-image]");
    await expect(image).toBeVisible();
    await expect(page.locator("[data-media-gallery-overlay]")).not.toHaveAttribute(
      "data-entering",
      "true",
    );
    const box = await image.boundingBox();

    if (!box) throw new Error("Expected the gallery image");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 160, { steps: 4 });
    await expect.poll(async () => (await image.boundingBox())?.y ?? 0).toBeGreaterThan(box.y + 150);
    const releasedBox = await image.boundingBox();
    await page.mouse.up();
    await expect(image).toHaveCount(1);
    await expect
      .poll(async () => (await image.boundingBox())?.y ?? 0)
      .toBeGreaterThan(releasedBox?.y ?? Infinity);
    await expect(page).not.toHaveURL(/[?&]media=/);
    await expect(image).toHaveCount(0);
    await attachment.click();
    await expect(image).toBeVisible();

    const slowExit = await page.addStyleTag({
      content: "[data-media-gallery-overlay][data-exiting] { animation-duration: 1s !important; }",
    });

    await page.getByRole("button", { name: "Close", exact: true }).click({ force: true });
    await expect(page.locator("[data-media-gallery-overlay]")).toHaveAttribute(
      "data-exiting",
      "true",
    );
    await expect(image).toHaveCount(1);
    await slowExit.evaluate((element) => element.parentNode?.removeChild(element));
    await expect(image).toHaveCount(0);
  });

  test("keeps the gallery backdrop opaque during off-center pinch zoom", async ({
    harness,
    page,
  }) => {
    const seededParty = await harness.seedJoinedParty({
      fixture: createExpenseLogFixture(1),
      memberParticipantId: defaultParticipants.blair.id,
    });

    await harness.navigate(`/party/${seededParty.partyId}/add`);
    await page.locator('input[aria-label="Upload photo"]').setInputFiles("public/pwa-192x192.png");
    await page.getByRole("button", { name: "View photo" }).click();
    const image = page.locator("[data-media-gallery-image]");
    const overlay = page.locator("[data-media-gallery-overlay]");
    await expect(image).toBeVisible();
    const box = await image.boundingBox();

    if (!box) throw new Error("Expected the gallery image");

    for (const deltaY of [-20, -50, -100, 600]) {
      // Ctrl+wheel is use-gesture's desktop pinch input, including rubber-banding below 1x.
      await image.dispatchEvent("wheel", {
        deltaY,
        ctrlKey: true,
        clientX: box.x + box.width / 2,
        clientY: box.y + box.height / 2 - 70,
        bubbles: true,
        cancelable: true,
      });

      const scale = expect.poll(() =>
        image.evaluate(
          (element) => new DOMMatrixReadOnly(getComputedStyle(element.parentElement!).transform).a,
        ),
      );

      if (deltaY < 0) await scale.toBeGreaterThan(1);
      else await scale.toBeLessThan(1);

      await expect(overlay).toHaveCSS("background-color", "rgba(0, 0, 0, 0.25)");
    }
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

    // SAFETY: attachmentButton is a button locator; evaluate invokes its native click during the overlay exit animation.
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
