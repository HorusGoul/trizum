import { createPaymentPartyFixture, defaultParticipants } from "./harness/scenarios";
import { expect, test } from "./harness/trizum.fixture";

// Replace only the external clipboard boundary so the same assertions run in WebKit.
test.beforeEach(async ({ page, context }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => localStorage.setItem("e2e-payment-copy", value),
      },
    });
  });
  await context.route("https://venmo.com/**", (route) =>
    route.fulfill({ body: "Payment profile" }),
  );
});

test("payment rows open links, copy independently, and cancel opening after a hold", async ({
  page,
  context,
  harness,
}) => {
  await page.clock.install();

  const seeded = await harness.seedJoinedParty({
    fixture: createPaymentPartyFixture(),
    memberParticipantId: defaultParticipants.blair.id,
  });

  await harness.navigate(
    `/party/${seeded.partyId}/pay?fromId=${defaultParticipants.blair.id}&toId=${defaultParticipants.alex.id}&amount=3000`,
  );
  const venmo = page.getByRole("link", { name: "Open Venmo", exact: true });
  const copy = page.getByRole("button", { name: "Copy Venmo details", exact: true });
  await expect(venmo).toHaveAttribute("href", "https://venmo.com/u/alex");
  await expect(copy).toHaveCSS("opacity", "0");
  await venmo.hover();
  await expect(copy).toHaveCSS("opacity", "1");
  await copy.focus();
  await expect(copy).toHaveCSS("opacity", "1");
  await copy.press("Enter");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("e2e-payment-copy")))
    .toBe("@alex");
  expect(context.pages()).toHaveLength(1);

  await page.evaluate(() => localStorage.removeItem("e2e-payment-copy"));
  await venmo.hover();
  await page.mouse.down();
  await page.clock.runFor(600);
  await page.mouse.up();
  await page.clock.resume();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("e2e-payment-copy")))
    .toBe("@alex");
  await expect(venmo).toBeFocused();

  // Some browsers deliver a compatibility click after the hold was cancelled.
  const heldClickWasAllowed = await venmo.evaluate((link) =>
    link.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }),
    ),
  );

  expect(heldClickWasAllowed).toBe(false);
  expect(context.pages()).toHaveLength(1);

  const keyboardPopupPromise = page.waitForEvent("popup");
  await venmo.press("Enter");
  const keyboardPopup = await keyboardPopupPromise;
  await expect(keyboardPopup).toHaveURL("https://venmo.com/u/alex");
  await keyboardPopup.close();

  const popupPromise = page.waitForEvent("popup");
  await venmo.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL("https://venmo.com/u/alex");
  await popup.close();
  await page.getByRole("button", { name: "Copy Bank transfer details", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("e2e-payment-copy")))
    .toBe("Alex\nIBAN: ES00 1234");
  await expect(page.getByText("Alex\nIBAN: ES00 1234", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Other", exact: true }).getByRole("link"),
  ).toHaveCount(0);
});

test("desktop settings retain edits through preview, copy, removal, and repeated saves", async ({
  page,
  harness,
}) => {
  await harness.seedPartyList({ username: "Alex", phone: "+34612345678" });
  await harness.navigate("/settings");
  await page.getByRole("button", { name: /Add payment method/ }).click();
  await page.getByRole("option", { name: "Venmo", exact: true }).click();
  const field = page.getByRole("textbox", { name: "Venmo", exact: true });
  await expect(field).toHaveAttribute("placeholder", "e.g. @yourname");
  await expect(
    page.getByText("Your Venmo username or profile link.", { exact: true }),
  ).toBeVisible();
  await expect(field).toBeFocused();
  await field.fill("@alex");
  await field.press("Tab");
  await expect(field).toHaveCount(0);
  const row = page.getByRole("button", { name: "Venmo actions", exact: true });
  await row.getByText("@alex", { exact: true }).click();
  const previewPromise = page.context().waitForEvent("page");
  await page.getByRole("menuitem", { name: "Preview payment link" }).click();
  const preview = await previewPromise;
  await expect(preview).toHaveURL("https://venmo.com/u/alex");
  await preview.close();
  await page.getByRole("button", { name: "More Venmo actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Copy details" }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("e2e-payment-copy")))
    .toBe("@alex");
  await page.getByRole("button", { name: "Bizum actions", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Preview payment link" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Remove payment method" }).click();
  await expect(page.getByRole("button", { name: "Bizum actions", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Settings saved", { exact: true })).toBeVisible();
  await harness.navigate("/settings");
  await expect(row).toContainText("https://venmo.com/u/alex");
  await row.press("Enter");
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await expect(field).toBeFocused();
  await expect(page.getByRole("button", { name: "Bizum actions", exact: true })).toHaveCount(0);
  await field.fill("@alex2");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/(?:\?.*)?$/);
  await harness.navigate("/settings");
  await expect(row).toContainText("https://venmo.com/u/alex2");
  await expect(field).toHaveCount(0);
});

test.describe("mobile payment settings", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("keeps touch copy available and copies a held link without opening it", async ({
    page,
    context,
    harness,
  }) => {
    await page.clock.install();

    const seeded = await harness.seedJoinedParty({
      fixture: createPaymentPartyFixture(),
      memberParticipantId: defaultParticipants.blair.id,
    });

    await harness.navigate(
      `/party/${seeded.partyId}/pay?fromId=${defaultParticipants.blair.id}&toId=${defaultParticipants.alex.id}&amount=3000`,
    );
    const copy = page.getByRole("button", { name: "Copy Venmo details", exact: true });
    await expect(copy).toHaveCSS("opacity", "1");
    await copy.tap();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("e2e-payment-copy")))
      .toBe("@alex");
    await page.evaluate(() => localStorage.removeItem("e2e-payment-copy"));
    const link = page.getByRole("link", { name: "Open Venmo", exact: true });
    await link.dispatchEvent("pointerdown", {
      pointerType: "touch",
      pointerId: 1,
      isPrimary: true,
      button: 0,
      buttons: 1,
    });
    await page.clock.runFor(600);
    await link.dispatchEvent("pointerup", {
      pointerType: "touch",
      pointerId: 1,
      isPrimary: true,
      button: 0,
      buttons: 0,
    });
    await page.clock.resume();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("e2e-payment-copy")))
      .toBe("@alex");

    const heldClickWasAllowed = await link.evaluate((element) =>
      element.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }),
      ),
    );

    expect(heldClickWasAllowed).toBe(false);
    expect(context.pages()).toHaveLength(1);
    const popupPromise = page.waitForEvent("popup");
    await link.tap();
    const popup = await popupPromise;
    await expect(popup).toHaveURL("https://venmo.com/u/alex");
    await popup.close();
  });

  test("adds, edits, and opens actions from the full mobile row", async ({ page, harness }) => {
    await harness.seedPartyList({ username: "Alex", phone: "" });
    await harness.navigate("/settings");
    await page.getByRole("button", { name: "Add payment method", exact: true }).tap();
    const picker = page.getByRole("dialog", { name: "Add payment method", exact: true });
    await expect(picker).toBeVisible();
    await picker.getByRole("option", { name: "Venmo", exact: true }).tap();
    await expect(picker).not.toBeVisible();
    const field = page.getByRole("textbox", { name: "Venmo", exact: true });
    await expect(field).toBeFocused();
    await field.fill("@alex");
    await expect(field).toHaveAccessibleDescription("Your Venmo username or profile link.");
    await page.getByRole("textbox", { name: "Username", exact: true }).tap();
    await expect(field).toHaveCount(0);
    const actions = page.getByRole("button", { name: "Venmo actions", exact: true });
    const rowContents = actions.getByText("@alex", { exact: true });
    await rowContents.dispatchEvent("pointerdown", {
      pointerType: "touch",
      pointerId: 1,
      isPrimary: true,
      button: 0,
      buttons: 1,
    });
    const sheet = page.getByRole("dialog", { name: "Venmo", exact: true });
    await expect(sheet).toBeVisible();
    await rowContents.dispatchEvent("pointerup", {
      pointerType: "touch",
      pointerId: 1,
      isPrimary: true,
      button: 0,
      buttons: 0,
    });
    await expect(sheet.getByRole("button", { name: "Preview payment link" })).toBeVisible();
    await sheet.getByRole("button", { name: "Copy details" }).tap();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("e2e-payment-copy")))
      .toBe("@alex");
    await expect(sheet).not.toBeVisible();
    await expect(actions).toContainText("@alex");
    await expect(field).toHaveCount(0);
    await expect(page.getByRole("button", { name: "More Venmo actions", exact: true })).toHaveCount(
      0,
    );
    await actions.tap({ position: { x: 2, y: 24 } });
    await sheet.getByRole("button", { name: "Edit", exact: true }).tap();
    await expect(field).toBeFocused();
    await field.fill("@alex-edited");
    await page.getByRole("textbox", { name: "Username", exact: true }).tap();
    await expect(field).toHaveCount(0);
    await actions.getByText("@alex-edited", { exact: true }).tap();
    await sheet.getByRole("button", { name: "Remove payment method" }).tap();
    await expect(actions).toHaveCount(0);
    await expect(field).toHaveCount(0);
    await page.getByRole("button", { name: "Add payment method", exact: true }).tap();
    await expect(picker.getByRole("option", { name: "Venmo", exact: true })).toBeVisible();
    await picker.getByRole("option", { name: "Other", exact: true }).tap();
    const instructions = "Wise transfer\nContact Alex for the account details";
    const otherField = page.getByRole("textbox", { name: "Other", exact: true });
    await expect(otherField).toBeFocused();
    await otherField.fill(instructions);
    await page.getByRole("textbox", { name: "Username", exact: true }).tap();
    await expect(otherField).toHaveCount(0);
    await page.getByRole("button", { name: "Save", exact: true }).tap();
    await expect(page).toHaveURL(/\/(?:\?.*)?$/);
    await harness.navigate("/settings");
    await page.getByRole("button", { name: "Other actions", exact: true }).tap();
    await page
      .getByRole("dialog", { name: "Other", exact: true })
      .getByRole("button", { name: "Edit", exact: true })
      .tap();
    await expect(otherField).toBeFocused();
    await expect(otherField).toHaveValue(instructions);
  });
});
