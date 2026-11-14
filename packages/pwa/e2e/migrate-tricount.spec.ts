import { expect, test } from "./harness/trizum.fixture";

test.describe("Migrate from Tricount form", () => {
  test("keeps import options when validation fails", async ({ harness, page }) => {
    const invalidKey = "not a tricount invite";

    await harness.goto("/migrate/tricount");
    await expect(page.getByRole("heading", { name: "Migrate from Tricount" })).toBeVisible();

    const keyField = page.getByLabel("Tricount URL or key");
    const importAttachments = page.getByRole("checkbox", { name: "Import attachments" });

    await keyField.fill(invalidKey);
    await page.getByText("Import attachments", { exact: true }).click();
    await expect(importAttachments).not.toBeChecked();
    await keyField.evaluate((input: HTMLInputElement) => input.form?.requestSubmit());

    await expect(page).toHaveURL(/\/migrate\/tricount(?:\?.*)?$/);
    await expect(keyField).toHaveValue(invalidKey);
    await expect(importAttachments).not.toBeChecked();
    await expect(page.getByText(/Please paste the Tricount sharing message/)).toBeVisible();
  });
});

test("lets users check the original link and retry with their import options", async ({
  harness,
  page,
}) => {
  const sharingMessage = "Join my trip: https://tricount.com/abc123";
  const importedKeys: string[] = [];
  await page.route("**/api/migrate?*", async (route) => {
    importedKeys.push(new URL(route.request().url()).searchParams.get("key") ?? "");
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Cannot read properties of undefined (reading 'Registry')",
        data: { Response: [] },
      }),
    });
  });
  await harness.goto("/migrate/tricount");
  const keyField = page.getByLabel("Tricount URL or key");
  const attachments = page.getByRole("checkbox", { name: "Import attachments" });
  await keyField.fill(sharingMessage);
  await page.getByText("Import attachments", { exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const errorHeading = page.getByRole("heading", { name: "Couldn't import this tricount" });
  await expect(errorHeading).toBeVisible();
  await expect(errorHeading).toBeFocused();
  await expect(page.getByText("Cannot read properties", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Check tricount link" }).click();
  await expect(keyField).toHaveValue(sharingMessage);
  await expect(attachments).not.toBeChecked();
  await keyField.fill("https://tricount.com/corrected456");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(errorHeading).toBeVisible();
  expect(importedKeys).toEqual(["abc123", "corrected456"]);
  await page.getByRole("button", { name: "Go back to home" }).click();
  await expect(page).toHaveURL(/\/(?:\?.*)?$/);
});
