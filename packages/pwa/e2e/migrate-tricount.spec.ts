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
