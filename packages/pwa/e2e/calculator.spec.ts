import {
  createExpenseLogFixture,
  createPartyFixture,
  defaultParticipants,
} from "./harness/scenarios";
import { expect, test } from "./harness/trizum.fixture";

const scrollTargetParticipant = {
  id: "participant-traveler-24",
  name: "Traveler 24",
} as const;

function createScrollableParticipantFixture() {
  const fixture = createPartyFixture();
  const extraParticipants = Object.fromEntries(
    Array.from({ length: 24 }, (_, index) => {
      const participantNumber = index + 1;
      const participant = {
        id: `participant-traveler-${participantNumber}`,
        name: `Traveler ${participantNumber}`,
      };

      return [participant.id, participant];
    }),
  );

  return {
    ...fixture,
    party: {
      ...fixture.party,
      participants: {
        ...fixture.party.participants,
        ...extraParticipants,
      },
    },
  };
}

test.describe("Expense calculator", () => {
  test("keeps the calculator button aligned when the amount is invalid", async ({
    harness,
    page,
  }) => {
    await page.setViewportSize({ width: 668, height: 250 });

    const seededParty = await harness.seedJoinedParty({
      fixture: createExpenseLogFixture(1),
      memberParticipantId: defaultParticipants.blair.id,
    });

    await harness.seedPartyList({
      username: "Harness User",
      phone: "",
      lastOpenedPartyId: seededParty.partyId,
      parties: {
        [seededParty.partyId]: true,
      },
      participantInParties: {
        [seededParty.partyId]: defaultParticipants.blair.id,
      },
    });
    await harness.navigate(`/party/${seededParty.partyId}/add`);

    const amountField = page.getByLabel("Amount", { exact: true });
    await page.getByLabel("Title", { exact: true }).fill("Dinner");
    await amountField.fill("0");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Amount must be greater than 0")).toBeVisible();

    const calculatorButton = page.getByRole("button", {
      name: "Open calculator",
      exact: true,
    });
    await expect(calculatorButton).toBeVisible();

    const amountBox = await amountField.boundingBox();
    const buttonBox = await calculatorButton.boundingBox();

    if (!amountBox || !buttonBox) {
      throw new Error("Expected the amount input and calculator button to be visible");
    }

    const buttonCenterY = buttonBox.y + buttonBox.height / 2;

    expect(buttonCenterY).toBeGreaterThanOrEqual(amountBox.y);
    expect(buttonCenterY).toBeLessThanOrEqual(amountBox.y + amountBox.height);
  });

  test("auto-opens without native input and replaces selected amounts", async ({
    harness,
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 633 });

    const seededParty = await harness.seedJoinedParty({
      fixture: createExpenseLogFixture(1),
      memberParticipantId: defaultParticipants.blair.id,
    });

    await harness.seedPartyList({
      username: "Harness User",
      phone: "",
      autoOpenCalculator: true,
      lastOpenedPartyId: seededParty.partyId,
      parties: {
        [seededParty.partyId]: true,
      },
      participantInParties: {
        [seededParty.partyId]: defaultParticipants.blair.id,
      },
    });
    await harness.navigate(`/party/${seededParty.partyId}/add`);

    const amountField = page.getByLabel("Amount", { exact: true });
    const calculator = page.getByRole("application", { name: "Calculator" });

    await amountField.click();
    await expect(page).toHaveURL(/\/add\?calculator=amount$/);
    await expect(amountField).toHaveAttribute("inputmode", "none");
    await expect(amountField).toHaveJSProperty("readOnly", true);
    await expect(calculator.getByText("Amount", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "1", exact: true }).click();
    await page.getByRole("button", { name: "2", exact: true }).click();
    await page.getByRole("button", { name: "Decimal point", exact: true }).click();
    await page.getByRole("button", { name: "3", exact: true }).click();
    await expect(amountField).toHaveValue("12.3");

    await page.goBack();
    await expect(page).toHaveURL(/\/add$/);
    await expect(calculator).not.toBeVisible();

    await amountField.click();
    await expect(page).toHaveURL(/\/add\?calculator=amount$/);
    await calculator.getByRole("button", { name: "7", exact: true }).click();
    await expect(amountField).toHaveValue("7");

    await calculator.getByRole("button", { name: "Calculate result", exact: true }).click();
    await expect(page).toHaveURL(/\/add$/);
    await expect(calculator).not.toBeVisible();

    await amountField.click();
    await expect(page).toHaveURL(/\/add\?calculator=amount$/);
    await expect(
      calculator.getByRole("button", { name: "Close calculator", exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/add$/);
    await expect(calculator).not.toBeVisible();
  });

  test("shows the active amount field label while editing", async ({ harness, page }) => {
    await page.setViewportSize({ width: 1280, height: 633 });

    const seededParty = await harness.seedJoinedParty({
      fixture: createExpenseLogFixture(1),
      memberParticipantId: defaultParticipants.blair.id,
    });

    await harness.seedPartyList({
      username: "Harness User",
      phone: "",
      autoOpenCalculator: true,
      lastOpenedPartyId: seededParty.partyId,
      parties: {
        [seededParty.partyId]: true,
      },
      participantInParties: {
        [seededParty.partyId]: defaultParticipants.blair.id,
      },
    });
    await harness.navigate(`/party/${seededParty.partyId}/add`);

    const calculator = page.getByRole("application", { name: "Calculator" });

    await page.getByLabel("Amount", { exact: true }).click();
    await expect(calculator.getByText("Amount", { exact: true })).toBeVisible();

    await page.goBack();
    await expect(calculator).not.toBeVisible();

    const blairCheckbox = page.getByRole("checkbox", {
      name: defaultParticipants.blair.name,
      exact: true,
    });
    await blairCheckbox.setChecked(true, { force: true });
    await expect(blairCheckbox).toBeChecked();
    const participantAmountField = page.getByLabel(`Amount for ${defaultParticipants.blair.name}`, {
      exact: true,
    });

    await participantAmountField.click();
    await expect(page).toHaveURL(/\/add\?calculator=share-participant-blair$/);
    await expect(
      calculator.getByText(`Amount for ${defaultParticipants.blair.name}`, { exact: true }),
    ).toBeVisible();
  });

  test("keeps the participant field visible and restores scroll on mobile", async ({
    harness,
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 520 });

    const seededParty = await harness.seedJoinedParty({
      fixture: createScrollableParticipantFixture(),
      memberParticipantId: defaultParticipants.blair.id,
    });

    await harness.seedPartyList({
      username: "Harness User",
      phone: "",
      autoOpenCalculator: true,
      lastOpenedPartyId: seededParty.partyId,
      parties: {
        [seededParty.partyId]: true,
      },
      participantInParties: {
        [seededParty.partyId]: defaultParticipants.blair.id,
      },
    });
    await harness.navigate(`/party/${seededParty.partyId}/add`);

    const targetCheckbox = page.getByRole("checkbox", {
      name: scrollTargetParticipant.name,
      exact: true,
    });
    await targetCheckbox.scrollIntoViewIfNeeded();
    await targetCheckbox.setChecked(true, { force: true });
    await expect(targetCheckbox).toBeChecked();

    const participantAmountField = page.getByLabel(`Amount for ${scrollTargetParticipant.name}`, {
      exact: true,
    });
    await participantAmountField.scrollIntoViewIfNeeded();
    await participantAmountField.evaluate((element) => {
      element.scrollIntoView({ block: "end", inline: "nearest" });
    });

    const scrollYBefore = await page.evaluate(() => window.scrollY);
    expect(scrollYBefore).toBeGreaterThan(100);

    await participantAmountField.click();
    await expect
      .poll(async () =>
        page.evaluate(() => new URLSearchParams(window.location.search).get("calculator")),
      )
      .toBe(`share-${scrollTargetParticipant.id}`);
    await expect
      .poll(async () => Math.round(await page.evaluate(() => window.scrollY)))
      .toBeGreaterThan(Math.round(scrollYBefore) - 8);

    const calculator = page.getByRole("application", { name: "Calculator" });
    await expect(calculator).toBeVisible();
    await expect
      .poll(async () => {
        const fieldBox = await participantAmountField.boundingBox();
        const calculatorBox = await calculator.boundingBox();

        if (!fieldBox || !calculatorBox) {
          return Number.POSITIVE_INFINITY;
        }

        return Math.round(fieldBox.y + fieldBox.height - calculatorBox.y);
      })
      .toBeLessThanOrEqual(0);

    const dragHandle = calculator.locator("[data-calculator-sheet-drag-handle]");
    await expect(dragHandle).toBeVisible();
    await expect
      .poll(async () => {
        const scrollYBeforeFrame = await page.evaluate(() => window.scrollY);
        const calculatorBoxBeforeFrame = await calculator.boundingBox();

        await page.evaluate(
          () =>
            new Promise<void>((resolve) => {
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
            }),
        );

        const scrollYAfterFrame = await page.evaluate(() => window.scrollY);
        const calculatorBoxAfterFrame = await calculator.boundingBox();

        if (!calculatorBoxBeforeFrame || !calculatorBoxAfterFrame) {
          return Number.POSITIVE_INFINITY;
        }

        return Math.max(
          Math.abs(scrollYAfterFrame - scrollYBeforeFrame),
          Math.abs(calculatorBoxAfterFrame.y - calculatorBoxBeforeFrame.y),
        );
      })
      .toBeLessThanOrEqual(1);
    await dragHandle.hover();

    const dragHandleBox = await dragHandle.boundingBox();
    if (!dragHandleBox) {
      throw new Error("Expected the calculator sheet drag handle to be visible");
    }

    const startX = dragHandleBox.x + dragHandleBox.width / 2;
    const startY = dragHandleBox.y + dragHandleBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY + 320, { steps: 12 });
    await page.mouse.up();

    expect(
      await page.evaluate(() => new URLSearchParams(window.location.search).get("calculator")),
    ).toBe(`share-${scrollTargetParticipant.id}`);

    await expect(page).toHaveURL(/\/add$/);
    await expect(calculator).not.toBeVisible();
    await expect(participantAmountField).not.toBeFocused();
    await expect
      .poll(async () => {
        const scrollYAfterClose = Math.round(await page.evaluate(() => window.scrollY));

        return Math.abs(scrollYAfterClose - Math.round(scrollYBefore));
      })
      .toBeLessThanOrEqual(8);
  });

  test("accepts supported physical keyboard input while open", async ({ harness, page }) => {
    await page.setViewportSize({ width: 1280, height: 633 });

    const seededParty = await harness.seedJoinedParty({
      fixture: createExpenseLogFixture(1),
      memberParticipantId: defaultParticipants.blair.id,
    });

    await harness.seedPartyList({
      username: "Harness User",
      phone: "",
      autoOpenCalculator: true,
      lastOpenedPartyId: seededParty.partyId,
      parties: {
        [seededParty.partyId]: true,
      },
      participantInParties: {
        [seededParty.partyId]: defaultParticipants.blair.id,
      },
    });
    await harness.navigate(`/party/${seededParty.partyId}/add`);

    const amountField = page.getByLabel("Amount", { exact: true });

    await amountField.click();
    await expect(page).toHaveURL(/\/add\?calculator=amount$/);

    await page.keyboard.type("12+3*2");
    await expect(amountField).toHaveValue("18");

    await page.keyboard.press("Backspace");
    await expect(amountField).toHaveValue("15");

    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/add$/);
  });
});
