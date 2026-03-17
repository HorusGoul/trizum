import { JoinTrizumPage } from "./pages/join-trizum.page";
import { NewTrizumPage } from "./pages/new-trizum.page";
import { WhoAreYouPage } from "./pages/who-are-you.page";
import { createPartyActivationScenario } from "./harness/scenarios";
import { defaultParticipants } from "./harness/scenarios";
import { createImbalancedPartyFixture } from "./harness/scenarios";
import { createPartyFixture } from "./harness/scenarios";
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

  test("can seed a persisted joined party without driving setup UI", async ({
    harness,
    page,
  }) => {
    const seededParty = await harness.joinSeededParty({
      fixture: createPartyFixture(),
      participantName: defaultParticipants.blair.name,
    });

    await harness.navigate("/");

    const seededPartyLink = page.getByRole("link", { name: /Weekend trip/ });

    await expect(seededPartyLink).toBeVisible();
    await seededPartyLink.click();

    await expect(page).toHaveURL(
      new RegExp(`/party/${seededParty.partyId}\\?tab=expenses(?:&.*)?$`),
    );
    await expect(
      page.getByRole("heading", { name: /Weekend trip/ }),
    ).toBeVisible();
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

  test("can create a party and complete participant selection from empty state", async ({
    harness,
    page,
  }) => {
    const newTrizumPage = new NewTrizumPage(page);
    const whoAreYouPage = new WhoAreYouPage(page);
    let partyId = "";

    await test.step("create a new party from /new", async () => {
      await harness.goto("/new");
      await newTrizumPage.expectLoaded();
      await newTrizumPage.createParty({
        name: createPartyActivationScenario.partyName,
        participants: createPartyActivationScenario.participants,
      });
    });

    await test.step("redirect through participant selection", async () => {
      await whoAreYouPage.expectLoaded();

      const partyPageUrl = new URL(page.url());
      const match = partyPageUrl.pathname.match(/^\/party\/([^/]+)\/who$/);

      expect(match?.[1]).toBeTruthy();
      partyId = match![1];

      await expect(
        whoAreYouPage.participantOption(
          createPartyActivationScenario.selectedParticipantName,
        ),
      ).toBeVisible();
    });

    await test.step("save the selected participant identity", async () => {
      await whoAreYouPage.selectParticipant(
        createPartyActivationScenario.selectedParticipantName,
      );
    });

    await test.step("land on the party expenses page", async () => {
      await expect(page).toHaveURL(
        new RegExp(`/party/${partyId}\\?tab=expenses(?:&.*)?$`),
      );
      await expect(
        page.getByRole("heading", {
          name: new RegExp(createPartyActivationScenario.partyName),
        }),
      ).toBeVisible();
      await expect(page.getByRole("tab", { name: "Expenses" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Expenses" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });
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
    await expect(
      page.getByText("You owe money to people"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Pay" })).toBeVisible();
  });
});
