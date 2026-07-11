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
const bottomScrollTargetParticipant = {
  id: "participant-zed-last",
  name: "ZZZ Last Traveler",
} as const;
const receiptImagePath = "public/pwa-64x64.png";

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
        [bottomScrollTargetParticipant.id]: bottomScrollTargetParticipant,
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

  test.describe("mobile touch", () => {
    test.use({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    });

    test("amount calculator button does not toggle closed when auto-open is enabled", async ({
      harness,
      page,
    }) => {
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

      await page.locator("[data-calculator-field-button]").first().tap();
      await expect(page).toHaveURL(/\/add\?calculator=amount$/);
      await expect(calculator.getByText("Amount", { exact: true })).toBeVisible();

      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/\/add\?calculator=amount$/);
      await expect(calculator).toBeVisible();
    });
  });

  test("closes without growing duplicate calculator history entries", async ({ harness, page }) => {
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
    await expect(page).toHaveURL(/\/add$/);

    const amountField = page.getByLabel("Amount", { exact: true });
    const calculator = page.getByRole("application", { name: "Calculator" });
    const initialHistoryLength = await page.evaluate(() => window.history.length);

    await amountField.click();
    await expect(page).toHaveURL(/\/add\?calculator=amount$/);
    await calculator.getByRole("button", { name: "7", exact: true }).click();
    await calculator.getByRole("button", { name: "Calculate result", exact: true }).click();
    await expect(page).toHaveURL(/\/add$/);
    await expect(calculator).not.toBeVisible();

    const historyLengthAfterFirstClose = await page.evaluate(() => window.history.length);
    expect(historyLengthAfterFirstClose).toBe(initialHistoryLength + 1);

    await amountField.click();
    await expect(page).toHaveURL(/\/add\?calculator=amount$/);
    await calculator.getByRole("button", { name: "8", exact: true }).click();
    await calculator.getByRole("button", { name: "Calculate result", exact: true }).click();
    await expect(page).toHaveURL(/\/add$/);
    await expect(calculator).not.toBeVisible();

    const historyLengthAfterSecondClose = await page.evaluate(() => window.history.length);
    expect(historyLengthAfterSecondClose).toBe(historyLengthAfterFirstClose);
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

  test("keeps fractional participant split when closing an unchanged amount calculator", async ({
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
      autoOpenCalculator: false,
      lastOpenedPartyId: seededParty.partyId,
      parties: {
        [seededParty.partyId]: true,
      },
      participantInParties: {
        [seededParty.partyId]: defaultParticipants.blair.id,
      },
    });
    await harness.navigate(`/party/${seededParty.partyId}/add`);

    await page.getByLabel("Amount", { exact: true }).fill("90");

    const blairCheckbox = page.getByRole("checkbox", {
      name: defaultParticipants.blair.name,
      exact: true,
    });
    await blairCheckbox.setChecked(true, { force: true });
    await expect(blairCheckbox).toBeChecked();

    const blairSharesField = page.getByLabel(`Shares for ${defaultParticipants.blair.name}`, {
      exact: true,
    });
    const blairAmountField = page.getByLabel(`Amount for ${defaultParticipants.blair.name}`, {
      exact: true,
    });

    await expect(blairSharesField).toBeVisible();
    await expect(blairAmountField).toHaveValue("90");

    await page
      .locator(
        `[data-calculator-field-button][data-presence-proxy-element-id="participant-${defaultParticipants.blair.id}"]`,
      )
      .click();
    await expect(page).toHaveURL(/\/add\?calculator=share-participant-blair$/);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/add$/);

    await expect(blairSharesField).toBeVisible();
    await expect(blairAmountField).toHaveValue("90");
  });

  test("keeps the participant field visible on mobile", async ({ harness, page }) => {
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
  });

  test("adds mobile scroll allowance for the last participant field", async ({ harness, page }) => {
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
      name: bottomScrollTargetParticipant.name,
      exact: true,
    });
    await targetCheckbox.scrollIntoViewIfNeeded();
    await targetCheckbox.setChecked(true, { force: true });
    await expect(targetCheckbox).toBeChecked();

    const participantAmountField = page.getByLabel(
      `Amount for ${bottomScrollTargetParticipant.name}`,
      { exact: true },
    );
    await participantAmountField.scrollIntoViewIfNeeded();
    await participantAmountField.evaluate((element) => {
      element.scrollIntoView({ block: "end", inline: "nearest" });
    });

    const scrollHeightBefore = await page.evaluate(() => document.documentElement.scrollHeight);

    await participantAmountField.click();
    await expect
      .poll(async () =>
        page.evaluate(() => new URLSearchParams(window.location.search).get("calculator")),
      )
      .toBe(`share-${bottomScrollTargetParticipant.id}`);

    const calculator = page.getByRole("application", { name: "Calculator" });
    await expect(calculator).toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate(() =>
          Number.parseFloat(
            window
              .getComputedStyle(document.documentElement)
              .getPropertyValue("--calculator-mobile-scroll-allowance"),
          ),
        ),
      )
      .toBeGreaterThan(0);
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.scrollHeight))
      .toBeGreaterThan(scrollHeightBefore);
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
  });

  test("shows mobile attachments while the calculator is open", async ({ harness, page }) => {
    await page.setViewportSize({ width: 390, height: 520 });

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

    await page
      .locator('input[aria-label="Upload photo"]')
      .setInputFiles(Array.from({ length: 4 }, () => receiptImagePath));
    await expect(page.getByRole("button", { name: "View photo" })).toHaveCount(4);

    const amountField = page.getByLabel("Amount", { exact: true });
    const calculator = page.getByRole("application", { name: "Calculator" });

    await amountField.click();
    await expect(page).toHaveURL(/\/add\?calculator=amount$/);
    await expect(calculator).toBeVisible();

    const attachmentsToolbarShell = page.locator("[data-calculator-attachment-toolbar]");
    const attachmentsToolbar = page.getByRole("toolbar", { name: "Attachments" });
    const firstAttachmentButton = attachmentsToolbar.getByRole("button", {
      name: "View attachment 1",
    });
    await expect(attachmentsToolbar).toBeVisible();
    for (let attachmentNumber = 1; attachmentNumber <= 4; attachmentNumber++) {
      await expect(
        attachmentsToolbar.getByRole("button", {
          name: `View attachment ${attachmentNumber}`,
          exact: true,
        }),
      ).toBeVisible();
    }
    await expect
      .poll(async () => {
        const toolbarBox = await attachmentsToolbarShell.boundingBox();

        if (!toolbarBox) {
          return Number.POSITIVE_INFINITY;
        }

        return Math.round(toolbarBox.y);
      })
      .toBe(0);
    await expect
      .poll(async () =>
        attachmentsToolbarShell.evaluate((element) => {
          const style = window.getComputedStyle(element);
          const backgroundColor = style.backgroundColor;

          return {
            backdropFilter: style.backdropFilter,
            hasTransparentBackground:
              backgroundColor.startsWith("rgba(") || backgroundColor.includes("/"),
          };
        }),
      )
      .toEqual({
        backdropFilter: "none",
        hasTransparentBackground: false,
      });
    await expect
      .poll(async () => {
        const toolbarBox = await attachmentsToolbar.boundingBox();
        const buttonBox = await firstAttachmentButton.boundingBox();

        if (!toolbarBox || !buttonBox) {
          return Number.POSITIVE_INFINITY;
        }

        return Math.round(buttonBox.x - toolbarBox.x);
      })
      .toBe(16);
    await expect
      .poll(async () => {
        const buttonBox = await firstAttachmentButton.boundingBox();
        const imageBox = await firstAttachmentButton.locator("img").boundingBox();

        if (!buttonBox || !imageBox) {
          return Number.POSITIVE_INFINITY;
        }

        return Math.min(
          Math.round(imageBox.x - buttonBox.x),
          Math.round(imageBox.y - buttonBox.y),
          Math.round(buttonBox.x + buttonBox.width - (imageBox.x + imageBox.width)),
          Math.round(buttonBox.y + buttonBox.height - (imageBox.y + imageBox.height)),
        );
      })
      .toBeGreaterThanOrEqual(1);
    await expect(page.getByRole("region", { name: "Attachment preview" })).toHaveCount(0);

    await firstAttachmentButton.click();
    const attachmentPreview = page.getByRole("region", { name: "Attachment preview" });
    await expect(attachmentPreview).toBeVisible();
    await expect
      .poll(async () => {
        const toolbarBox = await attachmentsToolbar.boundingBox();
        const closeButtonBox = await page
          .getByRole("button", { name: "Close attachment preview" })
          .boundingBox();

        if (!toolbarBox || !closeButtonBox) {
          return Number.POSITIVE_INFINITY;
        }

        return Math.round(
          toolbarBox.x + toolbarBox.width - (closeButtonBox.x + closeButtonBox.width),
        );
      })
      .toBe(16);
    await expect
      .poll(async () => {
        const toolbarBox = await attachmentsToolbarShell.boundingBox();
        const previewBox = await attachmentPreview.boundingBox();

        if (!toolbarBox || !previewBox) {
          return Number.POSITIVE_INFINITY;
        }

        return Math.abs(Math.round(previewBox.y - (toolbarBox.y + toolbarBox.height)));
      })
      .toBeLessThanOrEqual(1);
    await expect
      .poll(async () => {
        const previewBox = await attachmentPreview.boundingBox();
        const viewport = page.viewportSize();

        if (!previewBox || !viewport) {
          return Number.POSITIVE_INFINITY;
        }

        return Math.round(viewport.height - (previewBox.y + previewBox.height));
      })
      .toBeLessThanOrEqual(1);

    await attachmentPreview.click({ position: { x: 20, y: 20 } });
    await expect(page).toHaveURL(/\/add\?calculator=amount$/);
    await expect(calculator).toBeVisible();

    await page.getByRole("button", { name: "Close attachment preview" }).click();
    await expect(attachmentPreview).not.toBeVisible();

    await page.mouse.click(10, 120);
    await expect(page).toHaveURL(/\/add$/);
    await expect(calculator).not.toBeVisible();
  });

  test("closes from outside taps without focusing another field", async ({ harness, page }) => {
    await page.setViewportSize({ width: 390, height: 520 });

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
    const titleField = page.getByLabel("Title", { exact: true });
    const calculator = page.getByRole("application", { name: "Calculator" });

    await amountField.click();
    await expect(page).toHaveURL(/\/add\?calculator=amount$/);
    await expect(calculator).toBeVisible();

    await titleField.click();
    await expect(page).toHaveURL(/\/add$/);
    await expect(calculator).not.toBeVisible();
    await expect(amountField).not.toBeFocused();
    await expect(titleField).not.toBeFocused();

    await page.waitForTimeout(1600);
    await expect(page).toHaveURL(/\/add$/);
    await expect(calculator).not.toBeVisible();
  });

  test("animates browser back close without resetting scroll on mobile", async ({
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
    await expect
      .poll(async () => Math.round(await page.evaluate(() => window.scrollY)))
      .toBeGreaterThanOrEqual(Math.round(scrollYBefore) - 8);

    await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __calculatorBackScrollSamples?: number[];
        __stopCalculatorBackScrollSamples?: () => void;
      };

      testWindow.__calculatorBackScrollSamples = [];

      let animationFrameId = 0;
      function sampleScroll() {
        testWindow.__calculatorBackScrollSamples?.push(window.scrollY);
        animationFrameId = window.requestAnimationFrame(sampleScroll);
      }

      sampleScroll();
      testWindow.__stopCalculatorBackScrollSamples = () => {
        window.cancelAnimationFrame(animationFrameId);
      };
    });

    await page.goBack();
    await expect(page).toHaveURL(/\/add$/);
    await expect(calculator).toBeVisible({ timeout: 100 });

    await expect(calculator).not.toBeVisible();
    await expect(participantAmountField).not.toBeFocused();
    await page.waitForTimeout(1600);
    await expect(page).toHaveURL(/\/add$/);
    await expect(calculator).not.toBeVisible();
    await expect
      .poll(async () => {
        const scrollYAfterClose = Math.round(await page.evaluate(() => window.scrollY));

        return Math.abs(scrollYAfterClose - Math.round(scrollYBefore));
      })
      .toBeLessThanOrEqual(8);

    const scrollSamplesDuringBackClose = await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __calculatorBackScrollSamples?: number[];
        __stopCalculatorBackScrollSamples?: () => void;
      };

      testWindow.__stopCalculatorBackScrollSamples?.();

      return testWindow.__calculatorBackScrollSamples ?? [];
    });

    expect(scrollSamplesDuringBackClose.length).toBeGreaterThan(0);
    const minScrollYDuringBackClose = Math.min(...scrollSamplesDuringBackClose);
    expect(minScrollYDuringBackClose).toBeGreaterThanOrEqual(Math.round(scrollYBefore) - 8);
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
