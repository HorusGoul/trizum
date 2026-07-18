import { screenshot } from "#src/screenshot.ts";

screenshot("balances", async ({ page, takeScreenshot, setupParty }) => {
  await setupParty();

  await page
    .locator("[role='tab']", {
      hasText: /balances|balance/i,
    })
    .click();
  await page.getByText(/how should i balance|cómo debería equilibrar/i).waitFor();

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
      name: /breakfast churros|churros para desayunar/i,
    })
    .click();

  await page
    .getByRole("heading", {
      name: /breakfast churros|churros para desayunar/i,
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
      name: /breakfast churros|churros para desayunar/i,
    })
    .click();
  await page.locator("h1").waitFor();

  const expenseUrl = new URL(page.url());
  await page.goto(`${expenseUrl.pathname}/edit`);
  await page.locator('input[name="name"]').waitFor();

  await takeScreenshot();
});

screenshot("stats", async ({ page, takeScreenshot, setupParty }) => {
  await setupParty();

  await page.getByRole("button", { name: /menu|menú/i }).click();
  await page.getByRole("menuitem", { name: /stats|estadísticas/i }).click();
  await page.getByRole("heading", { name: /party stats|estadísticas del grupo/i }).waitFor();
  await page.getByText(/total spent|total gastado/i).waitFor();

  await takeScreenshot();
});

screenshot("group-members", async ({ page, takeScreenshot, setupParty }) => {
  await setupParty();

  const partyUrl = new URL(page.url());
  await page.goto(`${partyUrl.pathname}/who`);
  await page.getByRole("radio", { name: "Modest" }).waitFor();

  await takeScreenshot();
});
