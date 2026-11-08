import type { Page } from "@playwright/test";
import { createPartyFixture, defaultParticipants } from "./harness/scenarios";
import { expect, test, type BrowserHarness } from "./harness/trizum.fixture";

async function createExpenseTemplate(
  harness: BrowserHarness,
  page: Page,
  partyId: string,
  {
    amount,
    expenseTitle,
    includeEveryone = false,
    name,
  }: {
    amount?: string;
    expenseTitle?: string;
    includeEveryone?: boolean;
    name: string;
  },
) {
  // Save returns through browser history, so enter from the real template list.
  await harness.navigate(`/party/${partyId}/settings/expense-templates`);
  await page.getByRole("link", { name: "Add", exact: true }).click();
  await expect(page.getByRole("heading", { name: "New template" })).toBeVisible();
  await page.getByLabel("Name").fill(name);

  if (expenseTitle) {
    await page.getByLabel("Title").fill(expenseTitle);
  }

  if (amount) {
    await page.getByLabel("Amount").fill(amount);
  }

  if (includeEveryone) {
    await page.getByText("Always include everyone", { exact: true }).click();
  }

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Expense template created").last()).toBeVisible();
  // The toast appears before Back finishes; wait for its destination before continuing.
  await expect(page.getByRole("heading", { name: "Expense templates" })).toBeVisible();
}

async function openExpenseTemplatePicker(page: Page, partyId: string) {
  await page.getByRole("button", { name: "Add an expense" }).click();
  const dialog = page.getByRole("dialog", { name: "Add an expense" });

  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/party/${partyId}(?:\\?.*)?$`));

  return dialog;
}

test.describe("Expense templates", () => {
  test("animates initial and settled sheet reopenings without backdrop flashes", async ({
    harness,
    page,
  }) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 390, height: 844 });

    const seededParty = await harness.seedJoinedParty({
      fixture: createPartyFixture(),
      memberParticipantId: defaultParticipants.blair.id,
    });

    await createExpenseTemplate(harness, page, seededParty.partyId, {
      expenseTitle: "Groceries",
      name: "Weekly groceries",
    });
    await harness.navigate(`/party/${seededParty.partyId}`);

    await expect(page.getByText("Expense template created")).toBeHidden();

    for (let cycle = 0; cycle < 8; cycle++) {
      // Record actual motion on every complete open/close cycle.
      const framesPromise = page.evaluate(async () => {
        const frames: { time: number; y: number; height: number; opacity: number }[] = [];
        const start = performance.now();
        await new Promise<void>((resolve) => {
          const sample = () => {
            const container = document.querySelector(".react-modal-sheet-container");
            const backdrop = document.querySelector(".react-modal-sheet-backdrop");

            if (container && backdrop) {
              const style = getComputedStyle(container);
              frames.push({
                time: performance.now() - start,
                y: new DOMMatrixReadOnly(style.transform).m42,
                height: container.getBoundingClientRect().height,
                opacity: Number(getComputedStyle(backdrop).opacity),
              });
            }

            const latest = frames.at(-1);

            if (
              performance.now() - start < 2000 &&
              (!latest || latest.opacity < 1 || latest.y !== 0 || frames.length < 3)
            )
              requestAnimationFrame(sample);
            else resolve();
          };

          requestAnimationFrame(sample);
        });

        return frames;
      });

      await page.getByRole("button", { name: "Add an expense" }).click();
      const frames = await framesPromise;

      await test.info().attach(`open-cycle-${cycle}-frames`, {
        body: JSON.stringify(frames),
        contentType: "application/json",
      });
      expect(frames.length).toBeGreaterThan(2);
      expect(frames[0].y).toBeLessThanOrEqual(frames[0].height + 2);

      for (let index = 1; index < frames.length; index++) {
        expect(frames[index].opacity + 0.02).toBeGreaterThanOrEqual(frames[index - 1].opacity);
      }

      const movingFrames = frames.filter((frame) => frame.y > 1 && frame.y < frame.height - 1);
      expect(movingFrames.length).toBeGreaterThan(3);
      expect(frames.at(-1)?.opacity).toBe(1);

      if (cycle % 2 === 0) {
        const handle = await page.locator("[data-modal-sheet-drag-handle]").boundingBox();

        if (!handle) throw new Error("Expected a sheet drag handle");
        const x = handle.x + handle.width / 2;
        const y = handle.y + handle.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x, y + 350, { steps: 10 });
        await page.mouse.up();
      } else {
        await page.locator(".react-modal-sheet-backdrop").click({ position: { x: 20, y: 20 } });
      }

      await expect(page.locator(".react-modal-sheet-container")).toHaveCount(0);
    }
  });

  test("reverses an interrupted close from its current position without resetting", async ({
    harness,
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 390, height: 844 });

    const party = await harness.seedJoinedParty({
      fixture: createPartyFixture(),
      memberParticipantId: defaultParticipants.blair.id,
    });

    await createExpenseTemplate(harness, page, party.partyId, { name: "Template" });
    await harness.navigate(`/party/${party.partyId}`);
    await openExpenseTemplatePicker(page, party.partyId);
    const container = page.locator(".react-modal-sheet-container");
    const backdrop = page.locator(".react-modal-sheet-backdrop");
    await expect(backdrop).toHaveCSS("opacity", "1");

    await backdrop.click({ position: { x: 20, y: 20 } });

    const trace = await page
      .getByRole("button", { name: "Add an expense", exact: true, includeHidden: true })
      .evaluate(async (button) => {
        const backdrop = document.querySelector(".react-modal-sheet-backdrop");

        if (!(button instanceof HTMLElement) || !(backdrop instanceof HTMLElement))
          throw new Error("Expected sheet controls");
        const frames: { y: number; height: number }[] = [];
        await new Promise<void>((resolve) => {
          const waitForClosing = () => {
            const panel = document.querySelector(".react-modal-sheet-container");

            if (!panel) throw new Error("Sheet closed before interruption");
            const y = new DOMMatrixReadOnly(getComputedStyle(panel).transform).m42;
            const height = panel.getBoundingClientRect().height;

            if (y > height * 0.2 && y < height * 0.8) {
              button.click();
              resolve();
            } else requestAnimationFrame(waitForClosing);
          };

          requestAnimationFrame(waitForClosing);
        });
        await new Promise<void>((resolve) => {
          const sample = () => {
            const panel = document.querySelector(".react-modal-sheet-container");

            if (panel)
              frames.push({
                y: new DOMMatrixReadOnly(getComputedStyle(panel).transform).m42,
                height: panel.getBoundingClientRect().height,
              });
            else frames.push({ y: Infinity, height: 0 });

            if (frames.length < 45) requestAnimationFrame(sample);
            else resolve();
          };

          requestAnimationFrame(sample);
        });

        return frames;
      });

    expect(trace.every((frame) => frame.y < frame.height - 2)).toBe(true);
    expect(trace.filter((frame) => frame.y > 1).length).toBeGreaterThan(2);
    expect(trace.at(-1)?.y).toBe(0);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`keeps the sheet border at the screen edge during overdrag in ${colorScheme} mode`, async ({
      harness,
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme });

      const seededParty = await harness.seedJoinedParty({
        fixture: createPartyFixture(),
        memberParticipantId: defaultParticipants.blair.id,
      });

      await createExpenseTemplate(harness, page, seededParty.partyId, {
        expenseTitle: "Groceries",
        name: "Weekly groceries",
      });
      await harness.navigate(`/party/${seededParty.partyId}`);
      await openExpenseTemplatePicker(page, seededParty.partyId);
      // The app currently boots with a fixed dark class; exercise both surface palettes.
      await page.evaluate(
        (dark) => document.documentElement.classList.toggle("dark", dark),
        colorScheme === "dark",
      );
      const container = page.locator(".react-modal-sheet-container");
      const surface = page.locator("[data-sheet-surface]");
      const handle = page.locator("[data-modal-sheet-drag-handle]");
      await expect
        .poll(async () => {
          const box = await container.boundingBox();

          return box ? Math.abs(box.y + box.height - 844) : Infinity;
        })
        .toBeLessThan(1);
      const box = await handle.boundingBox();

      if (!box) throw new Error("Expected a visible sheet drag handle");
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y - 160, { steps: 12 });
      await expect
        .poll(async () => {
          const box = await container.boundingBox();

          return box ? box.y + box.height : Infinity;
        })
        .toBeLessThan(824);
      await expect(container).toHaveCSS("border-bottom-width", "0px");
      await expect(surface).toHaveCSS("border-bottom-width", "1px");
      await expect
        .poll(async () => {
          const box = await surface.boundingBox();

          return box ? Math.abs(box.y + box.height - 844) : Infinity;
        })
        .toBeLessThan(1);
      await page.screenshot({ path: test.info().outputPath("sheet-overdrag.png") });
      await page.mouse.up();
      await expect
        .poll(async () => {
          const box = await container.boundingBox();

          return box ? Math.abs(box.y + box.height - 844) : Infinity;
        })
        .toBeLessThan(1);
    });
  }

  test("uses the settings structure and validates template fields inline", async ({
    harness,
    page,
  }) => {
    const seededParty = await harness.seedJoinedParty({
      fixture: createPartyFixture(),
      memberParticipantId: defaultParticipants.blair.id,
    });

    await harness.navigate(`/party/${seededParty.partyId}/settings`);
    await expect(page.getByRole("heading", { name: "Expenses", level: 2 })).toBeVisible();

    const expenseTemplatesLink = page.getByRole("link", {
      name: /Expense templates Configure reusable defaults for new expenses/,
    });

    await expect(
      expenseTemplatesLink.locator('use[href$="#lucide.layout-template"]'),
    ).toBeVisible();
    await expenseTemplatesLink.click();

    await expect(page.getByRole("heading", { name: "Expense templates" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Personal", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Party", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Custom templates", level: 3 })).toBeVisible();
    await expect(page.getByText("No custom templates yet")).toBeVisible();
    await expect(page.getByRole("button", { name: /Blank Default template/ })).toContainText("📄");

    await page.getByRole("link", { name: "Add" }).click();
    await expect(page.getByRole("heading", { name: "Template", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Expense defaults", level: 2 })).toBeVisible();
    await expect(page.getByLabel("Template icon")).toHaveText("🧾");

    const nameField = page.getByLabel("Name");
    await expect(nameField).toHaveValue("Template 1");
    await nameField.clear();
    await expect(page.getByText("Please give this template a name")).toBeVisible();

    const iconButton = page.getByLabel("Template icon");

    const [nameBox, iconBox] = await Promise.all([
      nameField.boundingBox(),
      iconButton.boundingBox(),
    ]);

    expect(nameBox).not.toBeNull();
    expect(iconBox).not.toBeNull();
    expect(Math.abs(nameBox!.y - iconBox!.y)).toBeLessThanOrEqual(1);

    await expect(nameField).toHaveAttribute("maxlength", "40");
    await nameField.fill("Weekly groceries");
    const titleField = page.getByLabel("Title");
    await expect(titleField).toHaveAttribute("maxlength", "50");
    await titleField.fill("Groceries");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Expense template created")).toBeVisible();
    await page.getByRole("link", { name: "Add" }).click();
    await expect(page.getByLabel("Name")).toHaveValue("Template 2");
    await page.getByLabel("Name").fill(" weekly GROCERIES ");
    await expect(page.getByText("A template with this name already exists")).toBeVisible();
  });

  test("saves edits to a template with existing participant shares", async ({ harness, page }) => {
    const seededParty = await harness.seedJoinedParty({
      fixture: createPartyFixture(),
      memberParticipantId: defaultParticipants.blair.id,
    });

    await createExpenseTemplate(harness, page, seededParty.partyId, {
      includeEveryone: true,
      name: "Shared dinner",
    });
    await page.getByRole("link", { name: /Shared dinner/ }).click();
    await page.getByLabel("Name").fill("Team dinner");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Expense template saved").last()).toBeVisible();
    await expect(page.getByRole("link", { name: /Team dinner/ })).toBeVisible();
  });

  test("keeps explicit participants distinct from always including everyone", async ({
    harness,
    page,
  }) => {
    const seededParty = await harness.seedJoinedParty({
      fixture: createPartyFixture(),
      memberParticipantId: defaultParticipants.blair.id,
    });

    await harness.navigate(`/party/${seededParty.partyId}/settings/expense-templates`);
    await page.getByRole("link", { name: "Add", exact: true }).click();
    await page.getByLabel("Name").fill("Weekly groceries");
    await page.getByLabel("Title").fill("Groceries");
    await page.getByLabel("Amount").fill("48.50");

    const alwaysIncludeEveryone = page.getByRole("switch", {
      name: "Always include everyone",
    });

    await expect(page.getByRole("checkbox", { name: "Include all" })).toHaveCount(0);
    await expect(alwaysIncludeEveryone).not.toBeChecked();

    for (const participantName of ["Alex", "Blair", "Casey"]) {
      await page.getByRole("checkbox", { name: participantName }).setChecked(true, {
        force: true,
      });
    }

    await expect(alwaysIncludeEveryone).not.toBeChecked();

    await page.getByRole("checkbox", { name: "Alex" }).setChecked(false, { force: true });
    await page.getByText("Always include everyone", { exact: true }).click();
    await expect(alwaysIncludeEveryone).toBeChecked();

    for (const participantName of ["Alex", "Blair", "Casey"]) {
      await expect(page.getByRole("checkbox", { name: participantName })).toBeChecked();
    }

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Expense template created")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Expense templates" })).toBeVisible();

    await harness.navigate(`/party/${seededParty.partyId}/settings/participants`);
    await page.getByLabel("New participant name").fill("Morgan");
    await page.getByRole("button", { name: "Add participant" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Participants saved!")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Expense templates" })).toBeVisible();

    await harness.navigate(`/party/${seededParty.partyId}`);
    const dialog = await openExpenseTemplatePicker(page, seededParty.partyId);

    const blankExpense = dialog.getByRole("button", {
      name: /Blank Start with empty expense values/,
    });

    await expect(blankExpense).toContainText("📄");
    await expect(dialog.getByText("Default", { exact: true })).toHaveCount(0);

    const [sheetBox, sheetRootBox] = await Promise.all([
      page.locator(".react-modal-sheet-container").boundingBox(),
      page.locator(".react-modal-sheet-root").boundingBox(),
    ]);

    expect(sheetBox).not.toBeNull();
    expect(sheetRootBox).not.toBeNull();
    const leftGap = sheetBox!.x - sheetRootBox!.x;
    const rightGap = sheetRootBox!.x + sheetRootBox!.width - sheetBox!.x - sheetBox!.width;
    expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(1);

    await dialog.getByRole("button", { name: /Weekly groceries Groceries/ }).click();

    await expect(page.getByLabel("Title")).toHaveValue("Groceries");
    await expect(page.getByRole("textbox", { name: "Amount", exact: true })).toHaveValue("48.5");
    await expect(page.getByText("All expense checks passed")).toBeVisible();

    for (const participantName of ["Alex", "Blair", "Casey", "Morgan"]) {
      await expect(page.getByRole("checkbox", { name: participantName })).toBeChecked();
    }
  });

  test("can limit expense creation to custom templates", async ({ harness, page }) => {
    const seededParty = await harness.seedJoinedParty({
      fixture: createPartyFixture(),
      memberParticipantId: defaultParticipants.blair.id,
    });

    await harness.navigate(`/party/${seededParty.partyId}/settings/expense-templates`);

    const onlyUseCustomTemplates = page.getByRole("switch", {
      name: "Only use custom templates",
    });

    await expect(onlyUseCustomTemplates).toBeDisabled();
    await expect(page.getByText("Create a custom template to enable this setting.")).toBeVisible();

    await createExpenseTemplate(harness, page, seededParty.partyId, {
      expenseTitle: "Coffee",
      name: "Coffee run",
    });
    await page.getByText("Only use custom templates", { exact: true }).click();

    const confirmation = page.getByRole("dialog", {
      name: "Only use custom templates?",
    });

    await expect(confirmation).toContainText(
      "Coffee run will become the default. New expenses will always start from a custom template.",
    );
    await confirmation.getByRole("button", { name: "Cancel" }).click();
    await expect(confirmation).toBeHidden();
    await expect(onlyUseCustomTemplates).not.toBeChecked();
    await expect(page.getByRole("button", { name: /Blank Default template/ })).toBeVisible();

    await page.getByText("Only use custom templates", { exact: true }).click();
    await confirmation.getByRole("button", { name: "Use custom templates only" }).click();

    await expect(onlyUseCustomTemplates).toBeChecked();
    await expect(page.getByRole("link", { name: /Coffee run Default/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Coffee run Default template/ })).toBeVisible();

    await harness.navigate(`/party/${seededParty.partyId}`);
    await page.getByRole("button", { name: "Add an expense" }).click();
    await expect(page.getByRole("heading", { name: "New expense" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/party/${seededParty.partyId}/add\\?template=[^&]+$`));
    await expect(page.getByLabel("Title")).toHaveValue("Coffee");

    await createExpenseTemplate(harness, page, seededParty.partyId, {
      expenseTitle: "Dinner",
      name: "Dinner",
    });
    await harness.navigate(`/party/${seededParty.partyId}`);
    let picker = await openExpenseTemplatePicker(page, seededParty.partyId);
    await expect(
      picker.getByRole("button", { name: /Blank Start with empty expense values/ }),
    ).toHaveCount(0);
    await expect(picker.getByRole("button", { name: /Coffee run Coffee/ })).toBeVisible();
    await expect(picker.getByRole("button", { name: /Dinner Dinner/ })).toBeVisible();

    await harness.navigate(`/party/${seededParty.partyId}/settings/expense-templates`);
    await page.getByText("Only use custom templates", { exact: true }).click();
    await expect(onlyUseCustomTemplates).not.toBeChecked();
    await expect(page.getByRole("dialog", { name: "Only use custom templates?" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Coffee run Default/ })).toBeVisible();

    await page.getByText("Only use custom templates", { exact: true }).click();
    await expect(onlyUseCustomTemplates).toBeChecked();
    await expect(page.getByRole("dialog", { name: "Only use custom templates?" })).toHaveCount(0);
    await page.getByText("Only use custom templates", { exact: true }).click();
    await expect(onlyUseCustomTemplates).not.toBeChecked();

    await harness.navigate(`/party/${seededParty.partyId}`);
    picker = await openExpenseTemplatePicker(page, seededParty.partyId);
    await expect(
      picker.getByRole("button", { name: /Blank Start with empty expense values/ }),
    ).toBeVisible();
  });

  test("skips a blank-only picker and validates partially prefilled expenses", async ({
    harness,
    page,
  }) => {
    const seededParty = await harness.seedJoinedParty({
      fixture: createPartyFixture(),
      memberParticipantId: defaultParticipants.blair.id,
    });

    await harness.navigate(`/party/${seededParty.partyId}`);
    await page.getByRole("button", { name: "Add an expense" }).click();
    await expect(page.getByRole("heading", { name: "New expense" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Add an expense" })).toHaveCount(0);
    await expect(page.getByText("Add expense details to get started")).toBeVisible();

    await createExpenseTemplate(harness, page, seededParty.partyId, {
      expenseTitle: "Coffee",
      name: "Coffee run",
    });

    await harness.navigate(`/party/${seededParty.partyId}`);
    const dialog = await openExpenseTemplatePicker(page, seededParty.partyId);
    await dialog.getByRole("button", { name: /Coffee run Coffee/ }).click();

    await expect(page.getByLabel("Title")).toHaveValue("Coffee");
    await expect(page.getByText("Complete the required details")).toBeVisible();
  });

  test("uses the personal default preference and exposes its settings shortcut", async ({
    harness,
    page,
  }) => {
    const seededParty = await harness.seedJoinedParty({
      fixture: createPartyFixture(),
      memberParticipantId: defaultParticipants.blair.id,
    });

    await createExpenseTemplate(harness, page, seededParty.partyId, {
      amount: "12.50",
      expenseTitle: "Lunch",
      includeEveryone: true,
      name: "Team lunch",
    });
    await page.getByRole("button", { name: /Blank Default template/ }).click();
    await page.getByRole("option", { name: /Team lunch/ }).click();
    await expect(page.getByRole("link", { name: /Team lunch Default/ })).toBeVisible();

    await harness.navigate(`/party/${seededParty.partyId}`);
    let dialog = await openExpenseTemplatePicker(page, seededParty.partyId);
    await dialog.getByRole("button", { name: "Expense template options" }).click();
    await page.getByRole("menuitem", { name: "Manage expense templates" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/party/${seededParty.partyId}/settings/expense-templates(?:\\?.*)?$`),
    );

    await harness.navigate(`/party/${seededParty.partyId}`);
    dialog = await openExpenseTemplatePicker(page, seededParty.partyId);
    await dialog.getByRole("button", { name: "Expense template options" }).click();
    await page.getByRole("menuitem", { name: /Always use default template/ }).click();
    await page.locator(".react-modal-sheet-backdrop").click({ position: { x: 10, y: 10 } });
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Add an expense" }).click();
    await expect(page.getByRole("heading", { name: "New expense" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/party/${seededParty.partyId}/add\\?template=[^&]+$`));
    await expect(page.getByLabel("Title")).toHaveValue("Lunch");

    await harness.navigate(`/party/${seededParty.partyId}/settings/expense-templates`);

    const preferenceSwitch = page.getByRole("switch", {
      name: "Always use default template",
    });

    await expect(preferenceSwitch).toBeChecked();
    await page.getByText("Always use default template", { exact: true }).click();
    await expect(preferenceSwitch).not.toBeChecked();

    await harness.navigate(`/party/${seededParty.partyId}`);
    await expect(await openExpenseTemplatePicker(page, seededParty.partyId)).toBeVisible();
  });

  test("announces the four-template limit from settings and direct editor routes", async ({
    harness,
    page,
  }) => {
    const seededParty = await harness.seedJoinedParty({
      fixture: createPartyFixture(),
      memberParticipantId: defaultParticipants.blair.id,
    });

    for (const name of ["Breakfast", "Coffee", "Dinner", "Groceries"]) {
      await createExpenseTemplate(harness, page, seededParty.partyId, { name });
    }

    const limitMessage = "You can create up to 4 custom templates.";
    await expect(page.getByRole("link", { name: "Add" })).toHaveCount(0);
    const addButton = page.getByRole("button", { name: "Add" });
    await expect(addButton).toBeEnabled();
    await addButton.click();
    await expect(page.getByText(limitMessage).last()).toBeVisible();
    await expect(page.getByText(limitMessage)).toBeHidden({ timeout: 10_000 });

    await harness.navigate(`/party/${seededParty.partyId}/settings/expense-templates/new`);
    await expect(page.getByRole("heading", { name: "New template" })).toBeVisible();
    await page.getByLabel("Name").fill("Fifth template");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText(limitMessage).last()).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`/party/${seededParty.partyId}/settings/expense-templates/new(?:\\?.*)?$`),
    );
    await expect(page.getByLabel("Name")).toHaveValue("Fifth template");
  });
});
