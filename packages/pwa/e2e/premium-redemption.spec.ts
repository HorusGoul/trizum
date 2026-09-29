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

test("Google links offer checkout help without requiring users to identify their code type", async ({
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
  await page.getByText("Code not working in Google Play?", { exact: true }).click();
  await expect(page.getByText(/Some offers need to be redeemed at checkout/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Redeem in Google Play" })).toHaveAttribute(
    "href",
    "https://play.google.com/redeem?code=FRIENDS",
  );
  await expect(page.getByRole("link", { name: "Redeem in App Store" })).toHaveCount(0);
});

test("desktop visitors see both stores for the same branded link", async ({ harness, page }) => {
  await harness.goto("/redeem?code=FRIENDS");
  await expect(page.getByRole("link", { name: "Redeem in App Store" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Redeem in Google Play" })).toBeVisible();
});

test("redemption FAQs link to sign-in, Premium settings, and the current code in each store", async ({
  harness,
  page,
}) => {
  await harness.goto("/redeem?code=FRIENDS");
  await page.getByText("How do I redeem my code?", { exact: true }).click();
  await expect(page.getByRole("link", { name: "sign in", exact: true })).toHaveAttribute(
    "href",
    "/settings/cloud-sync",
  );
  await expect(page.getByRole("link", { name: "Premium settings", exact: true })).toHaveAttribute(
    "href",
    "/settings#premium",
  );
  await page.getByRole("textbox", { name: "Promo code" }).fill("UPDATED");
  await expect(page.getByRole("link", { name: "App Store", exact: true })).toHaveAttribute(
    "href",
    /code=UPDATED$/,
  );
  await expect(page.getByRole("link", { name: "Google Play", exact: true })).toHaveAttribute(
    "href",
    "https://play.google.com/redeem?code=UPDATED",
  );
});
