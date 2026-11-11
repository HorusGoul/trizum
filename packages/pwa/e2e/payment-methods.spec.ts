import { createPaymentPartyFixture, defaultParticipants } from "./harness/scenarios";
import { expect, test } from "./harness/trizum.fixture";

// Replace only the external clipboard boundary so the same assertions run in WebKit.
test.beforeEach(async ({ page, context }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          localStorage.setItem("e2e-payment-copy", value);
          localStorage.setItem(
            "e2e-payment-copy-count",
            String(Number(localStorage.getItem("e2e-payment-copy-count") ?? 0) + 1),
          );
        },
      },
    });
  });
  await context.route("https://venmo.com/**", (route) =>
    route.fulfill({ body: "Payment profile" }),
  );
});

test("payment cards open links, copy handles, and cancel opening after a hold", async ({
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
  await expect(page.getByRole("button", { name: "Copy Venmo details", exact: true })).toHaveCount(
    0,
  );
  await expect(venmo).toHaveAttribute("href", "https://venmo.com/u/alex");
  await expect(venmo).toContainText("@alex");
  await expect(venmo).not.toContainText("https://");
  await venmo.focus();
  await venmo.press("ControlOrMeta+c");
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
  const bankDetails = page.getByRole("button", { name: "Copy Bank transfer details", exact: true });
  await bankDetails.click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("e2e-payment-copy")))
    .toBe("@alex");
  await bankDetails.hover();
  await page.mouse.down();
  await page.clock.runFor(600);
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("e2e-payment-copy")))
    .toBe("Alex\nIBAN: ES00 1234");
  await expect(page.getByText("Alex\nIBAN: ES00 1234", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Copy Bizum details", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("e2e-payment-copy")))
    .toBe("+34612345678");
  const bizum = page.getByRole("button", { name: "Copy Bizum details", exact: true });

  const beforeHold = await page.evaluate(() =>
    Number(localStorage.getItem("e2e-payment-copy-count")),
  );

  await bizum.hover();
  await page.mouse.down();
  await page.clock.runFor(600);
  await page.mouse.up();
  await bizum.dispatchEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 });
  await expect
    .poll(() => page.evaluate(() => Number(localStorage.getItem("e2e-payment-copy-count"))))
    .toBe(beforeHold + 1);
  await expect(
    page.getByRole("region", { name: "Other", exact: true }).getByRole("link"),
  ).toHaveCount(0);
});

test("keyboard activation copies each non-link method once", async ({ page, harness }) => {
  const seeded = await harness.seedJoinedParty({
    fixture: createPaymentPartyFixture(),
    memberParticipantId: defaultParticipants.blair.id,
  });

  await harness.navigate(
    `/party/${seeded.partyId}/pay?fromId=${defaultParticipants.blair.id}&toId=${defaultParticipants.alex.id}&amount=3000`,
  );

  for (const { method, details } of [
    { method: "Bizum", details: "+34612345678" },
    { method: "Bank transfer", details: "Alex\nIBAN: ES00 1234" },
    { method: "Other", details: "Ask me for Wise" },
  ]) {
    const button = page.getByRole("button", { name: `Copy ${method} details`, exact: true });

    for (const key of ["Enter", "Space"]) {
      await button.focus();

      const count = await page.evaluate(() =>
        Number(localStorage.getItem("e2e-payment-copy-count") ?? 0),
      );

      await button.press(key);
      await expect
        .poll(() => page.evaluate(() => localStorage.getItem("e2e-payment-copy")))
        .toBe(details);
      await expect
        .poll(() => page.evaluate(() => Number(localStorage.getItem("e2e-payment-copy-count"))))
        .toBe(count + 1);
    }
  }
});

test("copies a selected account number through native browser copying", async ({
  page,
  harness,
  browserName,
}) => {
  const seeded = await harness.seedJoinedParty({
    fixture: createPaymentPartyFixture(),
    memberParticipantId: defaultParticipants.blair.id,
  });

  await harness.navigate(
    `/party/${seeded.partyId}/pay?fromId=${defaultParticipants.blair.id}&toId=${defaultParticipants.alex.id}&amount=3000`,
  );
  await page.evaluate(() => {
    document.addEventListener("copy", (event) => {
      localStorage.setItem(
        "e2e-native-copy",
        JSON.stringify({
          selected: window.getSelection()?.toString(),
          prevented: event.defaultPrevented,
        }),
      );
    });
  });
  const button = page.getByRole("button", { name: "Copy Bank transfer details", exact: true });
  await button.focus();
  const text = page.getByText("Alex\nIBAN: ES00 1234", { exact: true });

  const bounds = await text.evaluate((element, setSelection) => {
    const node = element.firstChild;

    if (!node) throw new Error("Missing bank details text");
    const start = (node.textContent ?? "").indexOf("ES00 1234");
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + "ES00 1234".length);

    if (setSelection) {
      // WebKit does not mouse-select native button text; seed the same selection precondition.
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }

    const rect = range.getBoundingClientRect();

    return { left: rect.left + 0.5, right: rect.right - 0.5, y: rect.y + rect.height / 2 };
  }, browserName === "webkit");

  if (browserName !== "webkit") {
    await page.mouse.move(bounds.left, bounds.y);
    await page.mouse.down();
    await page.mouse.move(bounds.right, bounds.y, { steps: 8 });
    await page.mouse.up();
  }

  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe("ES00 1234");
  await expect(button).toBeFocused();
  await page.keyboard.press("ControlOrMeta+c");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("e2e-native-copy")))
    .toBe(JSON.stringify({ selected: "ES00 1234", prevented: false }));
  expect(
    await page.evaluate(() => Number(localStorage.getItem("e2e-payment-copy-count") ?? 0)),
  ).toBe(0);
});

test("desktop settings retain edits through preview, copy, removal, and repeated saves", async ({
  page,
  harness,
}) => {
  await harness.seedPartyList({ username: "Alex", phone: "+34612345678" });
  await harness.navigate("/settings");
  await page.getByRole("button", { name: /Add payment method/ }).click();
  await page.getByRole("menuitem", { name: "Venmo", exact: true }).click();
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

test("blank payment methods are removed on save without restoring legacy Bizum", async ({
  page,
  harness,
}) => {
  await harness.seedPartyList({ username: "Alex", phone: "+34612345678" });
  await harness.navigate("/settings");
  await page.getByRole("button", { name: "Add payment method", exact: true }).click();
  await page.getByRole("menuitem", { name: "Venmo", exact: true }).click();
  await page.getByRole("textbox", { name: "Venmo", exact: true }).fill("@alex");
  await page.getByRole("button", { name: "Add payment method", exact: true }).click();
  await page.getByRole("menuitem", { name: "Other", exact: true }).click();
  await page.getByRole("textbox", { name: "Other", exact: true }).fill(" ");
  await page.getByRole("button", { name: "Bizum actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  const phone = page.getByRole("textbox", { name: "Bizum", exact: true });
  await expect(phone).toHaveAttribute("placeholder", "e.g. 612 345 678");
  await expect(page.getByText("Your Bizum phone number.", { exact: true })).toBeVisible();
  const phoneError = page.getByText("Enter a valid Bizum phone number.", { exact: true });
  await phone.fill("not a phone");
  await expect(phoneError).toHaveCount(0);
  await expect(phone).not.toHaveAttribute("aria-invalid", "true");
  await phone.press("Tab");
  await expect(phoneError).toBeVisible();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Bizum actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await expect(phone).toBeFocused();
  await expect(phoneError).toHaveCount(0);
  await phone.fill("");
  await page.getByRole("textbox", { name: "Username", exact: true }).click();
  await page.getByRole("button", { name: "Edit Bizum", exact: true }).click();
  await expect(phone).toBeFocused();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/(?:\?.*)?$/);
  await harness.goto("/settings");
  await expect(page.getByRole("button", { name: "Venmo actions", exact: true })).toContainText(
    "https://venmo.com/u/alex",
  );
  await expect(page.getByRole("textbox", { name: "Bizum", exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^(?:Edit Bizum|Bizum actions|Edit Other|Other actions)$/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Add payment method", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Bizum", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Other", exact: true })).toBeVisible();
});

test.describe("mobile payment settings", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("copies a held profile without opening it and opens the profile on tap", async ({
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
    await expect(page.getByRole("button", { name: "Copy Venmo details", exact: true })).toHaveCount(
      0,
    );
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
    await picker.getByRole("button", { name: "Venmo", exact: true }).tap();
    await expect(picker).not.toBeVisible();
    const field = page.getByRole("textbox", { name: "Venmo", exact: true });
    await expect(field).toBeFocused();
    await field.fill(" ");
    await page.getByRole("textbox", { name: "Username", exact: true }).tap();
    await page.getByRole("button", { name: "Edit Venmo", exact: true }).tap();
    await expect(field).toBeFocused();

    const invalidHandle = page.getByText("Enter a valid Venmo username or profile link.", {
      exact: true,
    });

    await field.fill("not a handle");
    await expect(invalidHandle).toHaveCount(0);
    await page.getByRole("textbox", { name: "Username", exact: true }).tap();
    await expect(invalidHandle).toBeVisible();
    await page.getByRole("button", { name: "Venmo actions", exact: true }).tap();
    await page
      .getByRole("dialog", { name: "Venmo", exact: true })
      .getByRole("button", { name: "Edit", exact: true })
      .tap();
    await expect(field).toBeFocused();
    await expect(invalidHandle).toHaveCount(0);
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
    await expect(picker.getByRole("button", { name: "Venmo", exact: true })).toBeVisible();
    await picker.getByRole("button", { name: "Other", exact: true }).tap();
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
