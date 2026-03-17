import { test } from "./harness/trizum.fixture";
import { HomePage } from "./pages/home.page";
import { JoinTrizumPage } from "./pages/join-trizum.page";
import { NewTrizumPage } from "./pages/new-trizum.page";

test.describe("Home smoke @smoke", () => {
  test("shows the empty-state actions on the home screen", async ({ page }) => {
    const homePage = new HomePage(page);

    await page.goto("/?__internal_offline_only=true");
    await homePage.expectLoaded();
  });

  test("navigates to create and join flows from the home screen", async ({
    page,
  }) => {
    const homePage = new HomePage(page);
    const newTrizumPage = new NewTrizumPage(page);
    const joinTrizumPage = new JoinTrizumPage(page);

    await test.step("open the create flow from the home screen", async () => {
      await page.goto("/?__internal_offline_only=true");
      await homePage.openCreateParty();
      await newTrizumPage.expectLoaded();
    });

    await test.step("open the join flow from the home screen", async () => {
      await page.goto("/?__internal_offline_only=true");
      await homePage.openJoinParty();
      await joinTrizumPage.expectLoaded();
    });
  });
});
