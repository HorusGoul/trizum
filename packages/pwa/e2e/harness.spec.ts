import { JoinTrizumPage } from "./pages/join-trizum.page";
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
    const inviteLink = `https://trizum.app${seededParty.joinUrl}`;
    const redirectedPartyPath = `/party/${seededParty.partyId}`;
    const expectedRedirectTarget = `${redirectedPartyPath}?tab=expenses`;

    await test.step(
      "start from a browser state that does not already belong to the party",
      async () => {
        const partyList = await harness.readPartyList();

        expect(partyList.parties[seededParty.partyId]).toBeUndefined();
        expect(
          partyList.participantInParties[seededParty.partyId],
        ).toBeUndefined();
      },
    );

    await test.step(
      "enter a valid invite link and land on participant selection",
      async () => {
        await harness.navigate("/join");
        await joinPage.expectLoaded();
        await joinPage.joinWithLinkOrCode(inviteLink);

        await expect
          .poll(async () => page.evaluate(() => window.location.pathname))
          .toBe(`${redirectedPartyPath}/who`);
        await expect
          .poll(async () => page.evaluate(() => window.location.search))
          .toBe(`?redirectTo=${encodeURIComponent(expectedRedirectTarget)}`);
        await expect(
          page.getByRole("heading", { name: "Who are you?" }),
        ).toBeVisible();
      },
    );

    await test.step("select an identity and save the membership", async () => {
      await harness.selectParticipantIdentity(defaultParticipants.blair.name);

      await expect
        .poll(async () => page.evaluate(() => window.location.pathname))
        .toBe(redirectedPartyPath);
      await expect
        .poll(async () => page.evaluate(() => window.location.search))
        .toBe("?tab=expenses");
      await expect(
        page.getByRole("heading", { name: /Weekend trip/ }),
      ).toBeVisible();

      const partyList = await harness.readPartyList();

      expect(partyList.parties[seededParty.partyId]).toBe(true);
      expect(partyList.participantInParties[seededParty.partyId]).toBe(
        defaultParticipants.blair.id,
      );
    });

    await test.step("reopen the party from persisted offline state", async () => {
      await harness.gotoParty(seededParty.partyId);

      await expect
        .poll(async () => page.evaluate(() => window.location.pathname))
        .toBe(redirectedPartyPath);
      await expect
        .poll(
          async () =>
            page.evaluate(() => {
              const search = new URLSearchParams(window.location.search);
              return {
                tab: search.get("tab"),
                offlineOnly: search.get("__internal_offline_only"),
              };
            }),
        )
        .toEqual({
          tab: "expenses",
          offlineOnly: "true",
        });
      await expect(
        page.getByRole("heading", { name: /Weekend trip/ }),
      ).toBeVisible();
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
