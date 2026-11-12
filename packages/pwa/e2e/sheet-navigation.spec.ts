import { fileURLToPath } from "node:url";
import { build } from "vite-plus";
import { expect, test } from "./harness/trizum.fixture";

let script: string;

test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    build: {
      write: false,
      lib: {
        entry: fileURLToPath(new URL("./harness/sheet-navigation.browser.ts", import.meta.url)),
        name: "sheetNavigationRegression",
        formats: ["iife"],
      },
    },
  });

  const outputs = Array.isArray(result) ? result : [result];
  const bundle = outputs.find((output) => "output" in output);

  const chunk =
    bundle && "output" in bundle ? bundle.output.find((item) => item.type === "chunk") : undefined;

  if (!chunk) throw new Error("Missing sheet-navigation browser bundle");
  script = chunk.code;
});

test.beforeEach(async ({ page }) => {
  await page.route("**/sheet-navigation.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: script }),
  );
  await page.route("**/sheet-landing", (route) =>
    route.fulfill({ contentType: "text/html", body: '<a href="/sheet-editor">Open editor</a>' }),
  );
  await page.route("**/sheet-editor", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<body><script src="/sheet-navigation.js"></script></body>',
    }),
  );
  await page.goto("/sheet-landing");
  // A normal link creates a new document, rather than a preceding SPA pushState entry.
  await page.getByRole("link", { name: "Open editor" }).click();
  await page.getByLabel("Expense draft").fill("Keep this handwritten draft");
});

test("Back closes a sheet after direct document entry and the next Back leaves the editor", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open suggestions" }).click();
  await expect(page.getByRole("dialog", { name: "Receipt suggestions" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/sheet-editor$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Expense draft")).toHaveValue("Keep this handwritten draft");
  await page.goBack();
  await expect(page).toHaveURL(/\/sheet-landing$/);
});

test("normal close removes the temporary Back step", async ({ page }) => {
  await page.getByRole("button", { name: "Open suggestions" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Close sheet" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.history.state?.__trizumSheetGuard))
    .toBeUndefined();
  await page.goBack();
  await expect(page).toHaveURL(/\/sheet-landing$/);
});

test("direct-entry nested and locked sheets keep Back local to the top sheet", async ({ page }) => {
  await page.getByRole("button", { name: "Open suggestions" }).click();
  await page.getByRole("button", { name: "Open locked sheet" }).click();
  await page.goBack();
  await expect(page).toHaveURL(/\/sheet-editor$/);
  await expect(page.getByRole("dialog")).toHaveCount(2);
  await page
    .getByRole("dialog", { name: "Locked sheet" })
    .getByRole("button", { name: "Unlock sheet" })
    .click();
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "Locked sheet" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Receipt suggestions" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Expense draft")).toHaveValue("Keep this handwritten draft");
  await page.goBack();
  await expect(page).toHaveURL(/\/sheet-landing$/);
});

test("route navigation cleans the guard before adding a real history entry", async ({ page }) => {
  await page.getByRole("button", { name: "Open suggestions" }).click();
  await page.getByRole("button", { name: "Navigate to settings" }).click();
  await expect(page).toHaveURL(/\/sheet-settings$/);
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.goBack();
  await expect(page).toHaveURL(/\/sheet-settings$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/sheet-editor$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/sheet-landing$/);
});

test("route replacement retains direct-entry sheet protection", async ({ page }) => {
  await page.getByRole("button", { name: "Open suggestions" }).click();
  await page.getByRole("button", { name: "Replace with settings" }).click();
  await expect(page).toHaveURL(/\/sheet-settings$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/sheet-settings$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/sheet-landing$/);
});

test("Forward cannot restore a retired guard as an extra Back step", async ({ page }) => {
  await page.getByRole("button", { name: "Open suggestions" }).click();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goForward();
  await expect
    .poll(() => page.evaluate(() => window.history.state?.__trizumSheetGuard))
    .toBeUndefined();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/sheet-landing$/);
});

test("reload consumes the vanished sheet's guard before the next Back", async ({ page }) => {
  await page.getByRole("button", { name: "Open suggestions" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.reload();
  await expect(page.getByLabel("Expense draft")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.history.state?.__trizumSheetGuard))
    .toBeUndefined();
  await page.goBack();
  await expect(page).toHaveURL(/\/sheet-landing$/);
});
