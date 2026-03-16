import { test } from "@playwright/test";
import {
  HomePage,
  JoinTrizumPage,
  NewTrizumPage,
} from "./pages/home.page";

test.describe("Home smoke @smoke", () => {
  test("shows the empty-state actions on the home screen", async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goto();
    await homePage.expectLoaded();
  });

  test("navigates to create and join flows from the home screen", async ({
    page,
  }) => {
    const homePage = new HomePage(page);
    const newTrizumPage = new NewTrizumPage(page);
    const joinTrizumPage = new JoinTrizumPage(page);

    await test.step("open the create flow from the home screen", async () => {
      await homePage.goto();
      await homePage.openCreateParty();
      await newTrizumPage.expectLoaded();
    });

    await test.step("open the join flow from the home screen", async () => {
      await homePage.goto();
      await homePage.openJoinParty();
      await joinTrizumPage.expectLoaded();
    });
  });
});
