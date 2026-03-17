import { JoinTrizumPage } from "./pages/join-trizum.page";
import { defaultParticipants } from "./harness/scenarios";
import { createImbalancedPartyFixture } from "./harness/scenarios";
import { createPartyFixture } from "./harness/scenarios";
import { HomePage } from "./pages/home.page";
import { expect, test } from "./harness/trizum.fixture";

test.describe("Browser harness", () => {
  test("starts every journey from a fresh offline home screen", async ({
    harness,
    page,
  }) => {
    await harness.gotoHome();

    await expect(page).toHaveURL(/\/\?__internal_offline_only=true$/);
    await expect(
      page.getByRole("heading", { name: "Welcome to trizum" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create a new Party" }),
    ).toBeVisible();
  });

  test("can reopen an existing persisted party from the home screen", async ({
    harness,
    page,
  }) => {
    const homePage = new HomePage(page);
    const seededParty = await harness.joinSeededParty({
      fixture: createImbalancedPartyFixture(),
      participantName: defaultParticipants.blair.name,
    });

    await test.step("load the home screen with persisted membership", async () => {
      await harness.gotoHome();

      await expect(page).toHaveURL(/\/\?__internal_offline_only=true$/);
      await homePage.expectPartyVisible(/Weekend trip/);
    });

    await test.step("open the existing party from the home list", async () => {
      await homePage.openParty(/Weekend trip/);

      await expect(page).toHaveURL(
        new RegExp(`/party/${seededParty.partyId}\\?tab=expenses(?:&.*)?$`),
      );
      await expect(
        page.getByRole("heading", { name: /Weekend trip/ }),
      ).toBeVisible();
      await expect(page.getByText("Cabin groceries")).toBeVisible();
    });
  });

  test("can exercise join flow without depending on live sync", async ({
    harness,
    page,
  }) => {
    const joinPage = new JoinTrizumPage(page);
    const seededParty = await harness.seedJoinableParty(createPartyFixture());

    await harness.navigate("/join");
    await joinPage.expectLoaded();
    await joinPage.joinWithCode(seededParty.joinCode);

    await expect(
      page.getByRole("heading", { name: "Who are you?" }),
    ).toBeVisible();

    await harness.selectParticipantIdentity(defaultParticipants.blair.name);

    await expect(
      page.getByRole("heading", { name: /Weekend trip/ }),
    ).toBeVisible();
  });

  test("can seed an imbalanced party for balances journeys", async ({
    harness,
    page,
  }) => {
    await harness.joinSeededParty({
      fixture: createImbalancedPartyFixture(),
      participantName: defaultParticipants.blair.name,
    });

    await page.getByRole("tab", { name: "Balances" }).click();

    await expect(
      page.getByRole("heading", { name: "How should I balance?" }),
    ).toBeVisible();
    await expect(page.getByText("You owe money to people")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pay" })).toBeVisible();
  });
});
