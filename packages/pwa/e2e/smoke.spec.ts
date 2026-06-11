import { defaultParticipants, createImbalancedPartyFixture } from "./harness/scenarios";
import { expect, test } from "./harness/trizum.fixture";
import { HomePage } from "./pages/home.page";
import { JoinTrizumPage } from "./pages/join-trizum.page";
import { NewTrizumPage } from "./pages/new-trizum.page";

test.describe("Home smoke @smoke", () => {
  test("shows the empty-state actions on the home screen", async ({ harness, page }) => {
    const homePage = new HomePage(page);

    await harness.gotoHome();
    await homePage.expectLoaded();
  });

  test("navigates to create and join flows from the home screen", async ({ harness, page }) => {
    const homePage = new HomePage(page);
    const newTrizumPage = new NewTrizumPage(page);
    const joinTrizumPage = new JoinTrizumPage(page);

    await test.step("open the create flow from the home screen", async () => {
      await harness.gotoHome();
      await homePage.openCreateParty();
      await newTrizumPage.expectLoaded();
    });

    await test.step("open the join flow from the home screen", async () => {
      await harness.gotoHome();
      await homePage.openJoinParty();
      await joinTrizumPage.expectLoaded();
    });
  });

  test("reopens an existing party from the home screen", async ({ harness, page }) => {
    const homePage = new HomePage(page);
    const seededParty = await harness.joinSeededParty({
      fixture: createImbalancedPartyFixture(),
      participantName: defaultParticipants.blair.name,
    });

    await test.step("render persisted party membership on home", async () => {
      await harness.gotoHome();

      await expect
        .poll(async () =>
          page.evaluate(() => {
            const search = new URLSearchParams(window.location.search);
            return {
              offlineOnly: search.get("__internal_offline_only"),
              pathname: window.location.pathname,
            };
          }),
        )
        .toEqual({
          offlineOnly: "true",
          pathname: "/",
        });
      await homePage.expectPartyVisible(/Weekend trip/);
    });

    await test.step("open the existing party card from home", async () => {
      await homePage.openParty(/Weekend trip/);

      await expect(page).toHaveURL(
        new RegExp(`/party/${seededParty.partyId}\\?tab=expenses(?:&.*)?$`),
      );
      await expect(page.getByRole("heading", { name: /Weekend trip/ })).toBeVisible();
      await expect(page.getByText("Cabin groceries")).toBeVisible();
    });
  });
});
