import { screenshot } from "#src/screenshot.ts";

screenshot("balances", async ({ page, takeScreenshot, setupParty }) => {
  await setupParty();

  await page
    .locator("[role='tab']", {
      hasText: /balances|balance/i,
    })
    .click();

  await page.waitForTimeout(1000);

  await takeScreenshot();
});

screenshot("expense-log", async ({ takeScreenshot, setupParty }) => {
  await setupParty();

  await takeScreenshot();
});

screenshot("expense-details", async ({ page, takeScreenshot, setupParty }) => {
  await setupParty();

  await page
    .getByRole("link", {
      name: "Breakfast churros",
    })
    .click();

  await page
    .getByRole("heading", {
      name: "Breakfast churros",
    })
    .waitFor({
      state: "visible",
    });

  await takeScreenshot();
});

screenshot("expense-editor", async ({ page, takeScreenshot, setupParty }) => {
  await setupParty();

  await page
    .getByRole("link", {
      name: "Breakfast churros",
    })
    .click();

  await page
    .getByRole("heading", {
      name: "Breakfast churros",
    })
    .waitFor({
      state: "visible",
    });

  const url = page.url();

  await page.goto(`${url}/edit`);

  await page
    .getByRole("heading", {
      name: /editing|editando/i,
    })
    .waitFor({
      state: "visible",
    });

  await takeScreenshot();
});
