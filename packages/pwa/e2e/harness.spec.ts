import { ExpenseDetailPage } from "./pages/expense-detail.page";
import { ExpenseEditorPage } from "./pages/expense-editor.page";
import { ExpensePage } from "./pages/expense.page";
import { JoinTrizumPage } from "./pages/join-trizum.page";
import { NewTrizumPage } from "./pages/new-trizum.page";
import { PartyPage } from "./pages/party.page";
import { PayPage } from "./pages/pay.page";
import { WhoAreYouPage } from "./pages/who-are-you.page";
import {
  createPartyActivationScenario,
  createImbalancedPartyFixture,
  createPartyFixture,
  createSettlementPartyFixture,
  defaultParticipants,
  expenseEntryJourney,
} from "./harness/scenarios";
import { expect, test } from "./harness/trizum.fixture";

function formatAmountText(amount: number) {
  return amount.toFixed(2).replace(".", ",");
}

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

  test("can add an expense in an existing party and see it in detail and list views", async ({
    harness,
    page,
  }) => {
    const partyPage = new PartyPage(page);
    const expenseEditorPage = new ExpenseEditorPage(page);
    const expenseDetailPage = new ExpenseDetailPage(page);
    const expectedAmountText = formatAmountText(expenseEntryJourney.amount);

    const seededParty = await harness.joinSeededParty({
      fixture: createPartyFixture(),
      participantName: expenseEntryJourney.selectedParticipantName,
    });

    await partyPage.expectLoaded(seededParty.partyId, "Weekend trip");
    await partyPage.openAddExpense();

    await expenseEditorPage.expectLoaded();
    await expenseEditorPage.fillTitle(expenseEntryJourney.title);
    await expenseEditorPage.fillAmount(expenseEntryJourney.amount);

    for (const participantName of expenseEntryJourney.participantNames) {
      await expenseEditorPage.setParticipantIncluded(participantName, true);
    }

    await expenseEditorPage.save();

    await expenseDetailPage.expectLoaded(
      seededParty.partyId,
      expenseEntryJourney.title,
      expectedAmountText,
    );
    await expenseDetailPage.goBack();

    await partyPage.expectLoaded(seededParty.partyId, "Weekend trip");
    await partyPage.expectExpenseInLog(
      expenseEntryJourney.title,
      expectedAmountText,
    );
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
