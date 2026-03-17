import { ExpensePage } from "./pages/expense.page";
import { JoinTrizumPage } from "./pages/join-trizum.page";
import { PartyPage } from "./pages/party.page";
import { PayPage } from "./pages/pay.page";
import { defaultParticipants } from "./harness/scenarios";
import { createImbalancedPartyFixture } from "./harness/scenarios";
import { createPartyFixture } from "./harness/scenarios";
import { createSettlementPartyFixture } from "./harness/scenarios";
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

  test("can settle a balance from the balances tab", async ({
    harness,
    page,
  }) => {
    const expensePage = new ExpensePage(page);
    const partyPage = new PartyPage(page);
    const payPage = new PayPage(page);
    const action = {
      actionLabel: "Pay" as const,
      fromLabel: `${defaultParticipants.blair.name} (me)`,
      toLabel: defaultParticipants.alex.name,
    };

    const seededParty = await test.step(
      "seed a deterministic party with one unsettled balance",
      async () =>
        harness.joinSeededParty({
          fixture: createSettlementPartyFixture(),
          participantName: defaultParticipants.blair.name,
        }),
    );

    await test.step(
      "open Balances and confirm the settlement action is rendered",
      async () => {
        await partyPage.openBalances();
        await partyPage.expectSettlementActionVisible(action);
      },
    );

    await test.step("open the payment route for that settlement", async () => {
      await partyPage.openSettlementAction(action);
      await payPage.expectLoaded("Pay");
      await payPage.expectSearchParams({
        amount: "3000",
        fromId: defaultParticipants.blair.id,
        toId: defaultParticipants.alex.id,
      });
    });

    await test.step(
      "complete the settlement and land on the transfer expense",
      async () => {
        await payPage.completeSettlement();
        await expensePage.expectLoaded(
          `Paid debt to ${defaultParticipants.alex.name}`,
        );
      },
    );

    await test.step(
      "return to Balances and confirm the prior settlement action is gone",
      async () => {
        await page.goBack();
        await expect(page).toHaveURL(
          new RegExp(`/party/${seededParty.partyId}\\?tab=balances(?:&.*)?$`),
        );
        await partyPage.expectSettlementActionRemoved(action);
        await partyPage.expectFullySettled();
      },
    );
  });
});
