import { ExpensePage } from "./pages/expense.page";
import { PartyPage } from "./pages/party.page";
import { TransferDebtPage } from "./pages/transfer-debt.page";
import {
  createDebtTransferDestinationFixture,
  createSettlementPartyFixture,
  debtTransferJourney,
  defaultParticipants,
} from "./harness/scenarios";
import { expect, test } from "./harness/trizum.fixture";

test.describe("Debt transfer", () => {
  test("moves a debt from one joined party to another through balances", async ({
    harness,
    page,
  }) => {
    const expensePage = new ExpensePage(page);
    const originPartyPage = new PartyPage(page);
    const destinationPartyPage = new PartyPage(page);
    const transferDebtPage = new TransferDebtPage(page);
    const originAction = {
      actionLabel: "Pay" as const,
      fromLabel: `${defaultParticipants.blair.name} (me)`,
      toLabel: defaultParticipants.alex.name,
    };
    const destinationAction = {
      actionLabel: "Pay" as const,
      fromLabel: `${debtTransferJourney.destinationMemberParticipant.name} (me)`,
      toLabel: debtTransferJourney.destinationCreditorParticipant.name,
    };

    const [originParty, destinationParty] =
      await test.step("seed both parties in one browser boot", async () =>
        harness.seedParties([
          createSettlementPartyFixture(),
          createDebtTransferDestinationFixture(),
        ]));

    await test.step("join both parties in the local party list", async () => {
      await harness.seedPartyList({
        username: "Harness User",
        phone: "",
        parties: {
          [originParty.partyId]: true,
          [destinationParty.partyId]: true,
        },
        participantInParties: {
          [originParty.partyId]: debtTransferJourney.originMemberParticipantId,
          [destinationParty.partyId]: debtTransferJourney.destinationMemberParticipant.id,
        },
      });
    });

    await test.step("open balances in the origin party and confirm the transfer action is available", async () => {
      await harness.navigate(`/party/${originParty.partyId}?tab=balances`);
      await originPartyPage.expectLoaded(originParty.partyId, debtTransferJourney.originPartyName);
      await originPartyPage.expectSettlementActionVisible(originAction);
      await originPartyPage.expectSettlementActionButtonVisible(
        originAction,
        "Transfer to another party",
      );
    });

    await test.step("choose the recommended destination creditor", async () => {
      await originPartyPage.openSettlementActionButton(originAction, "Transfer to another party");

      await transferDebtPage.expectLoaded();
      await transferDebtPage.expectSearchParams({
        amount: "3000",
        fromId: defaultParticipants.blair.id,
        toId: defaultParticipants.alex.id,
      });
      await transferDebtPage.expectParticipantStep();
      await transferDebtPage.expectRecommendedParticipant(
        debtTransferJourney.destinationCreditorParticipant.name,
      );
      await transferDebtPage.chooseParticipant(
        debtTransferJourney.destinationCreditorParticipant.name,
      );
    });

    await test.step("complete the transfer and settle the origin party balance", async () => {
      await transferDebtPage.completeTransfer();
      await expensePage.expectLoaded("Debt transfer to another party");

      await page.goBack();
      await expect(page).toHaveURL(
        new RegExp(`/party/${originParty.partyId}\\?tab=balances(?:&.*)?$`),
      );
      await harness.recalculatePartyBalances(originParty.partyId);
      await originPartyPage.expectSettlementActionRemoved(originAction);
      await originPartyPage.expectFullySettled();
    });

    await test.step("show the transferred debt as a new balance action in the destination party", async () => {
      await harness.recalculatePartyBalances(destinationParty.partyId);
      await harness.navigate(`/party/${destinationParty.partyId}?tab=balances`);
      await destinationPartyPage.expectLoaded(
        destinationParty.partyId,
        debtTransferJourney.destinationPartyName,
      );
      await destinationPartyPage.expectSettlementActionVisible(destinationAction);
    });
  });

  test("skips member selection when the destination party has one creditor", async ({
    harness,
    page,
  }) => {
    const originPartyPage = new PartyPage(page);
    const transferDebtPage = new TransferDebtPage(page);
    const originAction = {
      actionLabel: "Pay" as const,
      fromLabel: `${defaultParticipants.blair.name} (me)`,
      toLabel: defaultParticipants.alex.name,
    };

    const [originParty, destinationParty] = await harness.seedParties([
      createSettlementPartyFixture(),
      createDebtTransferDestinationFixture({
        includeExtraParticipant: false,
      }),
    ]);

    await harness.seedPartyList({
      username: "Harness User",
      phone: "",
      parties: {
        [originParty.partyId]: true,
        [destinationParty.partyId]: true,
      },
      participantInParties: {
        [originParty.partyId]: debtTransferJourney.originMemberParticipantId,
        [destinationParty.partyId]: debtTransferJourney.destinationMemberParticipant.id,
      },
    });

    await harness.navigate(`/party/${originParty.partyId}?tab=balances`);
    await originPartyPage.openSettlementActionButton(originAction, "Transfer to another party");

    await transferDebtPage.expectLoaded();
    await transferDebtPage.expectConfirmationStep();
  });

  test("hides the transfer action when no destination can receive the debt", async ({
    harness,
    page,
  }) => {
    const originPartyPage = new PartyPage(page);
    const originAction = {
      actionLabel: "Pay" as const,
      fromLabel: `${defaultParticipants.blair.name} (me)`,
      toLabel: defaultParticipants.alex.name,
    };

    const [originParty, destinationParty] = await harness.seedParties([
      createSettlementPartyFixture(),
      createDebtTransferDestinationFixture({
        includeCreditor: false,
        includeExtraParticipant: false,
      }),
    ]);

    await harness.seedPartyList({
      username: "Harness User",
      phone: "",
      parties: {
        [originParty.partyId]: true,
        [destinationParty.partyId]: true,
      },
      participantInParties: {
        [originParty.partyId]: debtTransferJourney.originMemberParticipantId,
        [destinationParty.partyId]: debtTransferJourney.destinationMemberParticipant.id,
      },
    });

    await harness.navigate(`/party/${originParty.partyId}?tab=balances`);
    await originPartyPage.expectLoaded(originParty.partyId, debtTransferJourney.originPartyName);
    await originPartyPage.expectSettlementActionVisible(originAction);
    await originPartyPage.expectSettlementActionButtonHidden(
      originAction,
      "Transfer to another party",
    );
  });
});
