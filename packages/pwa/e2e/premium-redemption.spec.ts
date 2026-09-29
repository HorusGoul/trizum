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

test("redemption FAQs open sign-in directly and preserve the edited code", async ({
  harness,
  page,
}) => {
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
  await harness.goto("/redeem?code=FRIENDS");
  await page.getByText("How do I redeem my code?", { exact: true }).click();
  await page.getByRole("textbox", { name: "Promo code" }).fill("UPDATED");
  await expect(page.getByRole("link", { name: "App Store", exact: true })).toHaveAttribute(
    "href",
    /code=UPDATED$/,
  );
  await expect(page.getByRole("link", { name: "Google Play", exact: true })).toHaveAttribute(
    "href",
    "https://play.google.com/redeem?code=UPDATED",
  );
  await page.getByRole("button", { name: "sign in", exact: true }).last().click();
  const signIn = page.getByRole("dialog", { name: "Sign in", exact: true });
  await expect(signIn).toBeVisible();
  await expect(page).toHaveURL(
    (url) => url.pathname === "/redeem" && url.searchParams.get("code") === "FRIENDS",
  );
  await page.keyboard.press("Escape");
  await expect(signIn).toBeHidden();
  await expect(page.getByRole("textbox", { name: "Promo code" })).toHaveValue("UPDATED");
  await page.getByRole("button", { name: "Premium settings", exact: true }).click();
  await expect(signIn).toBeVisible();
  await expect(page).toHaveURL(
    (url) => url.pathname === "/redeem" && url.searchParams.get("code") === "FRIENDS",
  );
});

test("signed-in visitors open Premium directly without a redundant sign-in step", async ({
  harness,
  page,
}) => {
  const user = {
    id: "redemption-account",
    name: "Alex",
    email: "alex@example.com",
    emailVerified: true,
    image: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({ json: { user, session: { userId: user.id } } }),
  );
  await page.route("**/api/auth/list-accounts", (route) => route.fulfill({ json: [] }));
  await harness.goto("/redeem?code=FRIENDS");
  await expect(page.getByText("Signed in as alex@example.com", { exact: true })).toBeVisible();
  await page.getByText("How do I redeem my code?", { exact: true }).click();
  await expect(page.getByRole("button", { name: "sign in", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Premium settings", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "trizum Premium", exact: true })).toBeVisible();
  await expect(page).toHaveURL(
    (url) => url.pathname === "/redeem" && url.searchParams.get("code") === "FRIENDS",
  );
});

test("signing in from Premium help opens Premium and keeps the edited redemption code", async ({
  harness,
  page,
}) => {
  let signedIn = false;
  const user = {
    id: "redemption-login",
    name: "Alex",
    email: "alex@example.com",
    emailVerified: true,
    image: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({ json: signedIn ? { user, session: { userId: user.id } } : null }),
  );
  await page.route("**/api/auth/list-accounts", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/cloud-sync/settings", (route) =>
    route.fulfill({
      json: {
        settings:
          route.request().method() === "PUT"
            ? { ...route.request().postDataJSON(), updatedAt: Date.now() }
            : null,
      },
    }),
  );
  await page.route("**/api/auth/sign-in/email", (route) => {
    signedIn = true;
    return route.fulfill({ json: { user } });
  });
  await harness.goto("/redeem?code=FRIENDS");
  await page.getByRole("textbox", { name: "Promo code" }).fill("UPDATED");
  await page.getByText("Already redeemed?", { exact: true }).click();
  await page.getByRole("button", { name: "Premium settings", exact: true }).click();
  const signIn = page.getByRole("dialog", { name: "Sign in", exact: true });
  await signIn.getByRole("button", { name: "Sign in with password", exact: true }).click();
  await signIn.getByRole("textbox", { name: "Email", exact: true }).fill(user.email);
  await signIn.getByLabel("Password", { exact: true }).fill("example-test-password");
  await signIn.getByRole("button", { name: "Sign in with password", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "trizum Premium", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close Premium", exact: true }).click();
  await expect(page.getByText("Signed in as alex@example.com", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Promo code" })).toHaveValue("UPDATED");
  await expect(page).toHaveURL((url) => url.pathname === "/redeem");
});

test("magic-link sign-in returns to redemption with the current code", async ({
  harness,
  page,
}) => {
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
  await page.route("**/api/auth/sign-in/magic-link", (route) =>
    route.fulfill({ json: { status: true } }),
  );
  await harness.goto("/redeem?code=FRIENDS");
  await page.getByRole("textbox", { name: "Promo code" }).fill("NEW&FAMILY");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const signIn = page.getByRole("dialog", { name: "Sign in", exact: true });
  await signIn.getByRole("textbox", { name: "Email", exact: true }).fill("alex@example.com");
  const requestPromise = page.waitForRequest("**/api/auth/sign-in/magic-link");
  await signIn.getByRole("button", { name: "Email me a sign-in link", exact: true }).click();
  const request = await requestPromise;
  const { callbackURL, newUserCallbackURL, errorCallbackURL } = request.postDataJSON();
  for (const callback of [callbackURL, newUserCallbackURL, errorCallbackURL]) {
    const callbackUrl = new URL(callback, page.url());
    expect(callbackUrl.pathname).toBe("/settings/cloud-sync");
    expect(callbackUrl.searchParams.get("returnTo")).toBe("/redeem?code=NEW%26FAMILY");
  }
  await expect(signIn.getByText(/Check your email/)).toBeVisible();
});

test("offline redemption explains the connection requirement and preserves the code", async ({
  harness,
  page,
  context,
}) => {
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
  await harness.goto("/redeem?code=FRIENDS");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText("You seem to be offline.", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Sign-in is unavailable, so we can’t link your offer to trizum yet.", {
      exact: true,
    }),
  ).toBeHidden();
  await page.getByRole("textbox", { name: "Promo code" }).fill("OFFLINE-CODE");
  await page.getByRole("link", { name: "Redeem in App Store", exact: true }).click();
  await expect(
    page.getByText("Connect to the internet to redeem your code. Your code will stay here.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Promo code" })).toHaveValue("OFFLINE-CODE");
  await expect(page).toHaveURL((url) => url.pathname === "/redeem");
  expect(context.pages()).toHaveLength(1);
  await context.setOffline(false);
  await expect(page.getByText("You seem to be offline.", { exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Redeem in App Store", exact: true }),
  ).toHaveAttribute("href", /code=OFFLINE-CODE$/);
});

test("an account service failure stays hidden until sign-in is requested", async ({
  harness,
  page,
}) => {
  let available = false;
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({
      status: available ? 200 : 503,
      json: available ? null : { message: "Temporarily unavailable" },
    }),
  );
  await harness.goto("/redeem?code=FRIENDS");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText("Sign-in is unavailable, so we can’t link your offer to trizum yet.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Redeem in App Store", exact: true })).toBeVisible();
  await expect(page.getByText("You seem to be offline.", { exact: true })).toBeHidden();
  await page.getByRole("textbox", { name: "Promo code" }).fill("UPDATED");
  available = true;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Promo code" })).toHaveValue("UPDATED");
});
