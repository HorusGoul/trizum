import { createPartyFixture, defaultParticipants } from "./harness/scenarios";
import { expect, test } from "./harness/trizum.fixture";
import { ExpenseDetailPage } from "./pages/expense-detail.page";

for (const width of [390, 1280]) {
  test(`swaps currency with the converted field and preserves conversion details at ${width}px`, async ({
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
    const original = page.getByLabel("Original amount (USD)", { exact: true });
    await original.fill("25");
    const converted = page.getByLabel("Converted amount (EUR)", { exact: true });
    await expect(converted).toHaveJSProperty("readOnly", true);
    await expect(converted).toHaveCSS("border-top-style", "dashed");
    await expect(converted).toHaveValue("20");

    const convertedBox = await converted.boundingBox();
    const selectedCurrencyBox = await currency.boundingBox();
    const originalBox = await original.boundingBox();
    const rateBox = await page.getByLabel("Exchange rate", { exact: true }).boundingBox();

    if (!convertedBox || !selectedCurrencyBox || !originalBox || !rateBox)
      throw new Error("Expected visible conversion fields");
    expect(Math.abs(convertedBox.y - originalBox.y)).toBeLessThan(2);
    expect(convertedBox.x).toBeGreaterThan(originalBox.x + originalBox.width);
    expect(selectedCurrencyBox.y).toBeGreaterThan(convertedBox.y + convertedBox.height);
    expect(Math.abs(selectedCurrencyBox.y - rateBox.y)).toBeLessThan(2);
    expect(selectedCurrencyBox.x).toBeGreaterThan(rateBox.x + rateBox.width);

    await page.getByLabel("Exchange rate", { exact: true }).fill("0.75");
    await page.getByLabel("Exchange rate", { exact: true }).blur();
    await expect(converted).toHaveValue("18.75");

    if (width === 390) await page.setViewportSize({ width, height: 520 });
    await page.getByRole("button", { name: "Open calculator", exact: true }).click();
    const calculator = page.getByRole("application", { name: "Calculator" });
    await expect(calculator).toBeVisible();
    await calculator.getByRole("button", { name: "4", exact: true }).click();
    await expect(converted).toHaveValue("3");
    await calculator.getByRole("button", { name: "0", exact: true }).click();
    await expect(converted).toHaveValue("30");
    await expect(original).toHaveValue("40");
    await expect(converted).toBeInViewport({ ratio: 1 });
    await expect
      .poll(async () => {
        const totalBox = await converted.boundingBox();
        const calculatorBox = await calculator.boundingBox();

        return Boolean(
          totalBox && calculatorBox && totalBox.y + totalBox.height <= calculatorBox.y,
        );
      })
      .toBe(true);
    const calculatorScreenshot = test.info().outputPath("expense-conversion-calculator.png");
    await page.screenshot({ path: calculatorScreenshot });
    await test
      .info()
      .attach("Live converted amount", { path: calculatorScreenshot, contentType: "image/png" });
    await calculator.getByRole("button", { name: "Calculate result", exact: true }).click();
    await expect(calculator).toBeHidden();
    await page.setViewportSize({ width, height: 844 });
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
    await expect(original).toHaveValue("40");
    await expect(page.getByLabel("Exchange rate", { exact: true })).toHaveValue("0.75");
    await expect(converted).toHaveValue("30");
  });
}
