import { expect, test } from "./harness/trizum.fixture";

test("branded Apple links prefill a code, stay out of search results, and use Apple's fixed destination", async ({
  harness,
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      configurable: true,
    }),
  );
  await harness.goto("/redeem?code=FRIENDS");
  await expect(page.getByRole("heading", { name: "Redeem code" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Promo code" })).toHaveValue("FRIENDS");
  await expect(page.getByRole("link", { name: "Redeem in App Store" })).toHaveAttribute(
    "href",
    "https://apps.apple.com/redeem?ctx=offercodes&id=6755971747&code=FRIENDS",
  );
  await expect(page.getByRole("link", { name: /Google Play/ })).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await page.getByRole("textbox", { name: "Promo code" }).fill("NEW&code=OTHER");
  await expect(page.getByRole("link", { name: "Redeem in App Store" })).toHaveAttribute(
    "href",
    /code=NEW%26code%3DOTHER$/,
  );
});

test("Google links explain custom-code checkout and label external redemption as one-time only", async ({
  harness,
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Linux; Android 16)",
      configurable: true,
    }),
  );
  await harness.goto("/redeem?code=FRIENDS");
  await expect(page.getByRole("textbox", { name: "Promo code" })).toHaveValue("FRIENDS");
  await page.getByText("Using a custom Google Play code?", { exact: true }).click();
  await expect(page.getByText(/For a custom subscription code/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Redeem a one-time code in Google Play" }),
  ).toHaveAttribute("href", "https://play.google.com/redeem?code=FRIENDS");
  await expect(page.getByRole("link", { name: "Redeem in App Store" })).toHaveCount(0);
});

test("desktop visitors see both stores for the same branded link", async ({ harness, page }) => {
  await harness.goto("/redeem?code=FRIENDS");
  await expect(page.getByRole("link", { name: "Redeem in App Store" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Redeem a one-time code in Google Play" }),
  ).toBeVisible();
});
