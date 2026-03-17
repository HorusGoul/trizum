import { ExpenseDetailPage } from "./pages/expense-detail.page";
import { ExpenseEditorPage } from "./pages/expense-editor.page";
import { JoinTrizumPage } from "./pages/join-trizum.page";
import { PartyPage } from "./pages/party.page";
import { defaultParticipants } from "./harness/scenarios";
import { expenseEntryJourney } from "./harness/scenarios";
import { createImbalancedPartyFixture } from "./harness/scenarios";
import { createPartyFixture } from "./harness/scenarios";
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
});
