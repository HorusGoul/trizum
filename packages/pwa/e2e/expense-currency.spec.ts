import { createPartyFixture, defaultParticipants } from "./harness/scenarios";
import { expect, test } from "./harness/trizum.fixture";
import { ExpenseDetailPage } from "./pages/expense-detail.page";

for (const width of [390, 1280]) {
  test(`keeps currency beside the amount and preserves conversion details at ${width}px`, async ({
    harness,
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route("**/api/exchange-rates?base=EUR", (route) =>
      route.fulfill({
        json: {
          base: "EUR",
          rates: {
            EUR: { rate: 1, date: "2099-01-01" },
            USD: { rate: 1.25, date: "2099-01-01" },
          },
        },
      }),
    );

    const { partyId } = await harness.seedJoinedParty({
      fixture: createPartyFixture(),
      memberParticipantId: defaultParticipants.blair.id,
    });

    await harness.navigate(`/party/${partyId}/add`);
    await expect(page.getByRole("heading", { name: "New expense" })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const cached = localStorage.getItem("trizum.exchange-rates.v1.EUR");

          return cached ? JSON.parse(cached).rates.USD.rate : null;
        }),
      )
      .toBe(1.25);

    const currency = page.getByRole("button", { name: /Currency$/ });
    const amount = page.getByLabel("Amount", { exact: true });
    const amountBox = await amount.boundingBox();
    const currencyBox = await currency.boundingBox();

    if (!amountBox || !currencyBox) throw new Error("Expected visible amount and currency fields");
    expect(Math.abs(amountBox.y - currencyBox.y)).toBeLessThan(2);
    expect(currencyBox.x).toBeGreaterThan(amountBox.x + amountBox.width);

    await page.getByLabel("Title", { exact: true }).fill("Dinner abroad");
    await currency.click();
    await page.getByRole("option", { name: /^USD/ }).click();
    await page.getByLabel("Amount", { exact: true }).fill("25");
    const converted = page.getByRole("status", { name: "Converted amount (EUR)", exact: true });
    await expect(
      page.getByRole("textbox", { name: "Converted amount (EUR)", exact: true }),
    ).toHaveCount(0);
    await expect(converted).toContainText("20,00");

    const convertedBox = await amount.boundingBox();
    const selectedCurrencyBox = await currency.boundingBox();

    if (!convertedBox || !selectedCurrencyBox)
      throw new Error("Expected visible converted amount and currency fields");
    expect(Math.abs(convertedBox.y - selectedCurrencyBox.y)).toBeLessThan(2);
    expect(selectedCurrencyBox.x).toBeGreaterThan(convertedBox.x + convertedBox.width);

    await page.getByLabel("Exchange rate", { exact: true }).fill("0.75");
    await page.getByLabel("Exchange rate", { exact: true }).blur();
    await expect(converted).toContainText("18,75");
    await page.getByText("Include all", { exact: true }).click();
    await expect(page.getByText("All expense checks passed", { exact: true })).toBeVisible();
    await expect(page.getByText("Complete the required details", { exact: true })).toBeHidden();
    await expect(
      page.getByText("Add expense details to get started", { exact: true }),
    ).toBeHidden();
    const screenshotPath = test.info().outputPath("expense-conversion.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await test
      .info()
      .attach("Expense conversion", { path: screenshotPath, contentType: "image/png" });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const detail = new ExpenseDetailPage(page);
    await expect(detail.heading("Dinner abroad")).toBeVisible();
    await expect(page.getByText("1 USD = 0.75 EUR", { exact: true })).toBeVisible();
    await detail.openEdit();
    await expect(page.getByRole("heading", { name: "Editing Dinner abroad" })).toBeVisible();
    await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("25");
    await expect(page.getByLabel("Exchange rate", { exact: true })).toHaveValue("0.75");
    await expect(converted).toContainText("18,75");
  });
}
