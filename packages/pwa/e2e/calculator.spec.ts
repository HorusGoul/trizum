import { createExpenseLogFixture, defaultParticipants } from "./harness/scenarios";
import { expect, test } from "./harness/trizum.fixture";

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
    await calculator.getByRole("button", { name: "Close calculator", exact: true }).click();
    await expect(page).toHaveURL(/\/add$/);
    await expect(calculator).not.toBeVisible();
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
