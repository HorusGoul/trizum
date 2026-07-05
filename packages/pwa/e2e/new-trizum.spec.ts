import { expect, test } from "./harness/trizum.fixture";
import { NewTrizumPage } from "./pages/new-trizum.page";

test.describe("New trizum form", () => {
  test("keeps draft values when validation fails", async ({ harness, page }) => {
    const newTrizumPage = new NewTrizumPage(page);
    const description = "Only the description has been filled";

    await harness.goto("/new");
    await newTrizumPage.expectLoaded();
    await newTrizumPage.descriptionField.fill(description);
    await newTrizumPage.save();

    await expect(page).toHaveURL(/\/new(?:\?.*)?$/);
    await expect(newTrizumPage.descriptionField).toHaveValue(description);
    await expect(page.getByText("Title is required")).toBeVisible();
  });
});
