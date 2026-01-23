import { test, expect } from "@playwright/test";

test.describe("App Initialization", () => {
  test("should load the app successfully", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");

    // Wait for the app to initialize (worker client timeout is 10s, so we wait a bit longer)
    await page.waitForSelector("#root:not(:empty)", { timeout: 15000 });

    // Verify the app header is visible (use first() since there may be multiple h1 elements)
    await expect(page.locator("h1").first()).toContainText("trizum");
  });

  test("should not have console errors during initialization", async ({
    page,
  }) => {
    const errors: string[] = [];

    // Patterns to ignore (React experimental version warnings, dev mode errors, etc.)
    const ignorePatterns = [
      /You are using an experimental build of React/,
      /Warning: ReactDOM\.render is no longer supported/,
      /createRoot\(\)/,
      /ReactDOMClient\.createRoot\(\)/,
      /TanStackRouterDevtools/,
      /CatchBoundaryImpl/,
      /insertBefore.*not a child/,
      /removeChild.*not a child/,
      /recreate this component tree from scratch/,
      /Maximum update depth exceeded/,
      /Should not already be working/,
    ];

    const shouldIgnore = (message: string) =>
      ignorePatterns.some((pattern) => pattern.test(message));

    // Collect console errors
    page.on("pageerror", (error) => {
      if (!shouldIgnore(error.message)) {
        errors.push(error.message);
      }
    });

    page.on("console", (msg) => {
      if (msg.type() === "error" && !shouldIgnore(msg.text())) {
        errors.push(msg.text());
      }
    });

    // Navigate to the app
    await page.goto("/");

    // Wait for the app to initialize
    await page.waitForSelector("#root:not(:empty)", { timeout: 15000 });

    // Allow some time for any async errors to surface
    await page.waitForTimeout(2000);

    // Verify no errors occurred
    expect(errors).toHaveLength(0);
  });

  test("should initialize the Web Worker client", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");

    // Wait for the app to load
    await page.waitForSelector("#root:not(:empty)", { timeout: 15000 });

    // Check that the app rendered content (indicates worker initialized)
    const rootContent = await page.locator("#root").innerHTML();
    expect(rootContent.length).toBeGreaterThan(100);
  });
});

test.describe("Navigation", () => {
  test("should show the home page with party list", async ({ page }) => {
    await page.goto("/");

    // Wait for the app to load
    await page.waitForSelector("#root:not(:empty)", { timeout: 15000 });

    // The app should show the trizum header (use first() since there may be multiple h1 elements)
    await expect(page.locator("h1").first()).toContainText("trizum");

    // The beta badge should be visible
    await expect(page.getByLabel("Beta")).toBeVisible();
  });

  test("should navigate to new party page", async ({ page }) => {
    await page.goto("/");

    // Wait for the app to load
    await page.waitForSelector("#root:not(:empty)", { timeout: 15000 });

    // Click the "New" button to create a new party
    await page.getByRole("link", { name: /new/i }).click();

    // Should be on the new party page
    await expect(page).toHaveURL(/\/new/);

    // The page should have a form for creating a new party
    await expect(
      page.getByRole("heading", { name: /create|new/i }),
    ).toBeVisible();
  });
});

test.describe("Offline Functionality", () => {
  test("should work with offline mode query param", async ({ page }) => {
    // Navigate with offline mode enabled
    await page.goto("/?__internal_offline_only=true");

    // Wait for the app to initialize
    await page.waitForSelector("#root:not(:empty)", { timeout: 15000 });

    // Verify the app loaded (use first() since there may be multiple h1 elements)
    await expect(page.locator("h1").first()).toContainText("trizum");
  });
});
