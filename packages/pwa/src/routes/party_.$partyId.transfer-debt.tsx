import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { Currency } from "dinero.js";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BackButton } from "#src/components/BackButton.tsx";
import { CurrencyText } from "#src/components/CurrencyText.tsx";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.ts";
import { useEligibleDebtTransferParties } from "#src/hooks/useEligibleDebtTransferParties.ts";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import {
  getDebtTransferParticipantMatch,
  type DebtTransferParticipantMatch,
} from "#src/lib/debtTransfer.ts";
import { guardParticipatingInParty } from "#src/lib/guards.ts";
import { Alert, AlertDescription, AlertTitle } from "#src/ui/Alert.tsx";
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.tsx";
import { AppSelect, SelectItem } from "#src/ui/Select.tsx";

interface TransferDebtSearchParams {
  fromId: string;
  toId: string;
  amount: number;
}

export const Route = createFileRoute("/party_/$partyId/transfer-debt")({
  component: RouteComponent,
  pendingComponent: PartyPendingComponent,
  validateSearch: (search): TransferDebtSearchParams => {
    if (
      typeof search.fromId !== "string" ||
      typeof search.toId !== "string" ||
      typeof search.amount !== "number" ||
      search.amount <= 0
    ) {
      throw new Error(t`Missing search params`);
    }

    return {
      fromId: search.fromId,
      toId: search.toId,
      amount: search.amount,
    };
  },
  async loader({ context, params, location }) {
    await guardParticipatingInParty(params.partyId, context, location);
  },
});

function RouteComponent() {
  const { fromId, toId, amount } = Route.useSearch();
  const { party, transferDebtToParty } = useCurrentParty();
  const currentParticipant = useCurrentParticipant();
  const eligibleDestinationParties = useEligibleDebtTransferParties();
  const navigate = useNavigate();

  const from = party.participants[fromId];
  const to = party.participants[toId];
  const isSupportedTransfer = fromId === currentParticipant.id;

  const [destinationPartyId, setDestinationPartyId] = useState<string>(() =>
    eligibleDestinationParties.length === 1
      ? eligibleDestinationParties[0].party.id
      : "",
  );
  const [destinationParticipantId, setDestinationParticipantId] =
    useState<string>("");

  const destinationPartyOptions = useMemo(
    () =>
      eligibleDestinationParties.map((entry) => ({
        id: entry.party.id,
        entry,
      })),
    [eligibleDestinationParties],
  );

  const selectedDestinationParty = destinationPartyOptions.find(
    ({ id }) => id === destinationPartyId,
  );

  const destinationParticipants = useMemo(() => {
    if (!selectedDestinationParty) {
      return [];
    }

    return Object.values(selectedDestinationParty.entry.party.participants)
      .filter(
        (participant) =>
          !participant.isArchived &&
          participant.id !==
            selectedDestinationParty.entry.currentParticipantId,
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [selectedDestinationParty]);

  const participantMatch = useMemo<DebtTransferParticipantMatch>(() => {
    return getDebtTransferParticipantMatch({
      sourceName: to?.name ?? "",
      participants: destinationParticipants,
    });
  }, [destinationParticipants, to?.name]);

  useEffect(() => {
    if (!selectedDestinationParty) {
      setDestinationParticipantId("");
      return;
    }

    setDestinationParticipantId((currentValue) => {
      if (
        destinationParticipants.some(
          (participant) => participant.id === currentValue,
        )
      ) {
        return currentValue;
      }

      return participantMatch.exactMatchParticipantId ?? "";
    });
  }, [destinationParticipants, participantMatch, selectedDestinationParty]);

  if (!from || !to) {
    return (
      <TransferDebtLayout title={t`Transfer debt`}>
        <InlineAlert
          title={t`This debt is no longer available`}
          description={t`Go back and try again from the balances list.`}
        />
      </TransferDebtLayout>
    );
  }

  if (!isSupportedTransfer) {
    return (
      <TransferDebtLayout title={t`Transfer debt`}>
        <InlineAlert
          title={t`Only your own debt can be transferred`}
          description={t`You can only transfer debt from actions where you are the one who owes the money.`}
        />
      </TransferDebtLayout>
    );
  }

  const destinationCurrentParticipant = selectedDestinationParty
    ? selectedDestinationParty.entry.party.participants[
        selectedDestinationParty.entry.currentParticipantId
      ]
    : null;
  const sourceCreditorName = to.name;
  const originPartyName = party.name;
  const destinationPartyName = selectedDestinationParty?.entry.party.name ?? "";
  const destinationCurrentParticipantName =
    destinationCurrentParticipant?.name ?? "";
  const recommendedParticipants = participantMatch.recommendedParticipantIds
    .map((participantId) =>
      destinationParticipants.find(
        (participant) => participant.id === participantId,
      ),
    )
    .filter(
      (participant): participant is (typeof destinationParticipants)[number] =>
        !!participant,
    );
  const selectedDestinationCounterparty = destinationParticipants.find(
    (participant) => participant.id === destinationParticipantId,
  );
  const selectedDestinationCounterpartyName =
    selectedDestinationCounterparty?.name ?? "";
  const canTransfer =
    !!selectedDestinationParty &&
    !!selectedDestinationCounterparty &&
    destinationParticipantId !== "";

  function onTransferDebt() {
    if (!selectedDestinationParty || !selectedDestinationCounterparty) {
      return;
    }

    const transferPromise = transferDebtToParty({
      destinationPartyId: selectedDestinationParty.entry.party.id,
      originDebtorId: fromId,
      originCreditorId: toId,
      destinationDebtorId: selectedDestinationParty.entry.currentParticipantId,
      destinationCreditorId: selectedDestinationCounterparty.id,
      amount,
      paidAt: new Date(),
      originExpenseName: t`Debt transfer to another party`,
      destinationExpenseName: t`Debt transfer from another party`,
    });

    toast.promise(transferPromise, {
      loading: t`Transferring debt...`,
      success: t`Debt transferred`,
      error: t`Failed to transfer debt`,
    });

    void transferPromise.then(({ originExpense }) => {
      return navigate({
        to: "/party/$partyId/expense/$expenseId",
        params: {
          partyId: party.id,
          expenseId: originExpense.id,
        },
        replace: true,
      });
    });
  }

  return (
    <TransferDebtLayout title={t`Transfer debt`}>
      <div className="container flex flex-col gap-4 px-4 pt-4">
        <DebtSummaryCard
          currency={party.currency}
          fromName={from.name}
          toName={to.name}
          amount={amount}
        />

        {eligibleDestinationParties.length === 0 ? (
          <InlineAlert
            title={t`No destination party available`}
            description={t`You need another active party with the same currency to transfer this debt.`}
          />
        ) : (
          <>
            <AppSelect<(typeof destinationPartyOptions)[number]>
              label={t`Destination party`}
              description={t`Choose the party where this debt should continue`}
              items={destinationPartyOptions}
              selectedKey={destinationPartyId || undefined}
              onSelectionChange={(value) => {
                setDestinationPartyId(String(value ?? ""));
              }}
            >
              {(option) => (
                <SelectItem key={option.id} value={option}>
                  {option.entry.party.name}
                </SelectItem>
              )}
            </AppSelect>

            {selectedDestinationParty ? (
              <div className="rounded-xl bg-white p-4 dark:bg-accent-900">
                <div className="text-sm text-accent-700 dark:text-accent-300">
                  <Trans>You are</Trans>
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {destinationCurrentParticipantName}
                </div>
              </div>
            ) : null}

            {selectedDestinationParty ? (
              <AppSelect<(typeof destinationParticipants)[number]>
                label={t`Who is ${sourceCreditorName} in this party?`}
                description={t`Choose the participant who should receive the transferred debt`}
                items={destinationParticipants}
                selectedKey={destinationParticipantId || undefined}
                onSelectionChange={(value) => {
                  setDestinationParticipantId(String(value ?? ""));
                }}
              >
                {(participant) => (
                  <SelectItem key={participant.id} value={participant}>
                    {participant.name}
                  </SelectItem>
                )}
              </AppSelect>
            ) : null}

            {selectedDestinationParty && recommendedParticipants.length > 0 ? (
              <div className="rounded-xl bg-white p-4 dark:bg-accent-900">
                <div className="text-sm font-medium text-accent-700 dark:text-accent-300">
                  <Trans>Recommendations</Trans>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {recommendedParticipants.map((participant) => (
                    <Button
                      key={participant.id}
                      color="input-like"
                      className="h-auto rounded-full px-3 py-2"
                      onPress={() => {
                        setDestinationParticipantId(participant.id);
                      }}
                    >
                      {participant.name}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {selectedDestinationParty &&
            destinationParticipants.length === 0 ? (
              <InlineAlert
                title={t`Nobody else is available in this party`}
                description={t`This party needs another active participant besides you to receive the transferred debt.`}
              />
            ) : null}

            {selectedDestinationParty && selectedDestinationCounterparty ? (
              <div className="rounded-xl bg-white p-4 dark:bg-accent-900">
                <div className="flex items-center gap-2 text-sm text-accent-700 dark:text-accent-300">
                  <Icon icon="lucide.arrow-right-left" width={16} height={16} />
                  <span>
                    <Trans>What will happen</Trans>
                  </span>
                </div>

                <p className="mt-3">
                  <Trans>
                    This will settle the debt in{" "}
                    <span className="font-medium">{originPartyName}</span> and
                    create the same debt in{" "}
                    <span className="font-medium">{destinationPartyName}</span>,
                    where{" "}
                    <span className="font-medium">
                      {selectedDestinationCounterpartyName}
                    </span>{" "}
                    is owed by{" "}
                    <span className="font-medium">
                      {destinationCurrentParticipantName}
                    </span>
                    .
                  </Trans>
                </p>
              </div>
            ) : null}

            <Button
              color="accent"
              className="mt-2 font-semibold"
              isDisabled={!canTransfer}
              onPress={onTransferDebt}
            >
              <Icon icon="lucide.arrow-right-left" width={20} height={20} />
              <span className="ml-2">
                <Trans>Transfer debt</Trans>
              </span>
            </Button>
          </>
        )}
      </div>

      <div className="h-16 flex-shrink-0" />
    </TransferDebtLayout>
  );
}

function TransferDebtLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2 mt-safe">
        <BackButton fallbackOptions={{ to: "/party/$partyId" }} />
        <h1 className="max-h-12 truncate px-4 text-xl font-medium">{title}</h1>
      </div>

      {children}
    </div>
  );
}

function DebtSummaryCard({
  fromName,
  toName,
  amount,
  currency,
}: {
  fromName: string;
  toName: string;
  amount: number;
  currency: Currency;
}) {
  return (
    <div className="flex rounded-xl bg-white p-4 dark:bg-accent-900">
      <div className="flex flex-1 flex-col">
        <span className="text-lg text-accent-400">{fromName}</span>
        <span className="text-sm text-accent-700 dark:text-accent-300">
          <Trans>owes</Trans>
        </span>
        <span className="text-lg text-accent-400">{toName}</span>
      </div>

      <div className="flex flex-shrink-0 items-center">
        <CurrencyText currency={currency} amount={amount} className="text-xl" />
      </div>
    </div>
  );
}

function InlineAlert({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="container px-4 pt-4">
      <Alert variant="default">
        <Icon icon="lucide.badge-info" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </Alert>
    </div>
  );
}
