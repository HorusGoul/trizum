import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, LazyMotion, domAnimation, m } from "motion/react";
import { useReducer } from "react";
import { toast } from "sonner";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.ts";
import {
  type EligibleDebtTransferParty,
  useEligibleDebtTransferParties,
} from "#src/hooks/useEligibleDebtTransferParties.ts";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import { getDebtTransferParticipantMatch } from "#src/lib/debtTransfer.ts";
import { guardParticipatingInParty } from "#src/lib/guards.ts";
import type { PartyParticipant } from "#src/models/party.ts";
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.tsx";
import { DestinationParticipantCard } from "./-components/DestinationParticipantCard.js";
import { DestinationPartyCard } from "./-components/DestinationPartyCard.js";
import { InlineAlert } from "./-components/InlineAlert.js";
import { SectionIntro } from "./-components/SectionIntro.js";
import { TransferDebtLayout } from "./-components/TransferDebtLayout.js";
import { TransferReviewCard } from "./-components/TransferReviewCard.js";
import { TransferSuccessState } from "./-components/TransferSuccessState.js";
import type { DestinationPartyOption } from "./-components/types.js";

interface TransferDebtSearchParams {
  fromId: string;
  toId: string;
  amount: number;
}

type TransferStep = "party" | "participant" | "confirm" | "success";

interface TransferDebtState {
  destinationPartyId: string;
  destinationParticipantId: string;
  step: TransferStep;
  partySelectionPrefilled: boolean;
  participantSelectionPrefilled: boolean;
  isSubmitting: boolean;
}

type TransferDebtAction =
  | {
      type: "destinationPartySelected";
      partyId: string;
      prefilledParticipantId: string;
    }
  | { type: "destinationParticipantSelected"; participantId: string }
  | { type: "stepRequested"; step: TransferStep }
  | { type: "submitStarted" }
  | { type: "submitSucceeded" }
  | { type: "submitFailed" };

function getPrefilledParticipantId(option: DestinationPartyOption): string {
  return option.otherParticipants.length === 1 ? (option.otherParticipants[0]?.id ?? "") : "";
}

function createInitialTransferDebtState(
  destinationPartyOptions: DestinationPartyOption[],
): TransferDebtState {
  const prefilledParty = destinationPartyOptions.length === 1 ? destinationPartyOptions[0] : null;
  const prefilledParticipantId = prefilledParty ? getPrefilledParticipantId(prefilledParty) : "";

  if (!prefilledParty) {
    return {
      destinationPartyId: "",
      destinationParticipantId: "",
      step: "party",
      partySelectionPrefilled: false,
      participantSelectionPrefilled: false,
      isSubmitting: false,
    };
  }

  return {
    destinationPartyId: prefilledParty.id,
    destinationParticipantId: prefilledParticipantId,
    step: prefilledParticipantId ? "confirm" : "participant",
    partySelectionPrefilled: true,
    participantSelectionPrefilled: prefilledParticipantId !== "",
    isSubmitting: false,
  };
}

function transferDebtReducer(
  state: TransferDebtState,
  action: TransferDebtAction,
): TransferDebtState {
  switch (action.type) {
    case "destinationPartySelected":
      return {
        ...state,
        destinationPartyId: action.partyId,
        destinationParticipantId: action.prefilledParticipantId,
        step: action.prefilledParticipantId ? "confirm" : "participant",
        partySelectionPrefilled: false,
        participantSelectionPrefilled: action.prefilledParticipantId !== "",
      };

    case "destinationParticipantSelected":
      return {
        ...state,
        destinationParticipantId: action.participantId,
        step: "confirm",
        participantSelectionPrefilled: false,
      };

    case "stepRequested":
      return {
        ...state,
        step: action.step,
      };

    case "submitStarted":
      return {
        ...state,
        isSubmitting: true,
      };

    case "submitSucceeded":
      return {
        ...state,
        step: "success",
        isSubmitting: false,
      };

    case "submitFailed":
      return {
        ...state,
        isSubmitting: false,
      };
  }
}

function getVisibleTransferStep({
  step,
  hasSelectedDestinationParty,
  hasSelectedDestinationParticipant,
}: {
  step: TransferStep;
  hasSelectedDestinationParty: boolean;
  hasSelectedDestinationParticipant: boolean;
}): TransferStep {
  if (step === "success") {
    return "success";
  }

  if (!hasSelectedDestinationParty) {
    return "party";
  }

  if (step === "confirm" && !hasSelectedDestinationParticipant) {
    return "participant";
  }

  return step;
}

function getPreviousTransferStep({
  activeStep,
  partySelectionPrefilled,
  participantSelectionPrefilled,
}: {
  activeStep: TransferStep;
  partySelectionPrefilled: boolean;
  participantSelectionPrefilled: boolean;
}): TransferStep | null {
  if (activeStep === "confirm" && !participantSelectionPrefilled) {
    return "participant";
  }

  if ((activeStep === "confirm" || activeStep === "participant") && !partySelectionPrefilled) {
    return "party";
  }

  return null;
}

function getDestinationPartyOptions(
  eligibleDestinationParties: EligibleDebtTransferParty[],
  sourceName: string,
): DestinationPartyOption[] {
  return eligibleDestinationParties.map((entry) => {
    const otherParticipants = entry.otherParticipants;
    const participantById = new Map<string, PartyParticipant>();
    for (const participant of otherParticipants) {
      participantById.set(participant.id, participant);
    }

    const participantMatch = getDebtTransferParticipantMatch({
      sourceName,
      participants: otherParticipants,
    });
    const exactMatchParticipant =
      participantById.get(participantMatch.exactMatchParticipantId ?? "") ?? null;
    const recommendedParticipants: PartyParticipant[] = [];

    for (const participantId of participantMatch.recommendedParticipantIds) {
      const participant = participantById.get(participantId);
      if (participant) {
        recommendedParticipants.push(participant);
      }
    }

    return {
      id: entry.party.id,
      entry,
      currentParticipant: entry.currentParticipant,
      otherParticipants,
      exactMatchParticipant,
      recommendedParticipants,
    };
  });
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
  return useTransferDebtRouteView();
}

function useTransferDebtRouteView() {
  const { fromId, toId, amount } = Route.useSearch();
  const { party, transferDebtToParty } = useCurrentParty();
  const currentParticipant = useCurrentParticipant();
  const eligibleDestinationParties = useEligibleDebtTransferParties();
  const navigate = useNavigate();

  const from = party.participants[fromId];
  const to = party.participants[toId];
  const isSupportedTransfer = fromId === currentParticipant.id;

  const destinationPartyOptions = getDestinationPartyOptions(
    eligibleDestinationParties,
    to?.name ?? "",
  );

  const [state, dispatch] = useReducer(
    transferDebtReducer,
    destinationPartyOptions,
    createInitialTransferDebtState,
  );
  const selectedDestinationParty = destinationPartyOptions.find(
    ({ id }) => id === state.destinationPartyId,
  );
  const destinationParticipants = selectedDestinationParty?.otherParticipants ?? [];
  const priorityDestinationParticipants = selectedDestinationParty
    ? [
        selectedDestinationParty.exactMatchParticipant,
        ...selectedDestinationParty.recommendedParticipants,
      ].filter((participant): participant is PartyParticipant => !!participant)
    : [];
  const priorityDestinationParticipantIds = new Set(
    priorityDestinationParticipants.map(({ id }) => id),
  );
  const orderedDestinationParticipants = [
    ...priorityDestinationParticipants,
    ...destinationParticipants.filter(({ id }) => !priorityDestinationParticipantIds.has(id)),
  ];
  const hasSelectedDestinationParticipant = destinationParticipants.some(
    ({ id }) => id === state.destinationParticipantId,
  );
  const selectedDestinationParticipantId = hasSelectedDestinationParticipant
    ? state.destinationParticipantId
    : "";
  const selectedDestinationCounterparty = destinationParticipants.find(
    (participant) => participant.id === selectedDestinationParticipantId,
  );
  const canTransfer =
    !!selectedDestinationParty &&
    !!selectedDestinationCounterparty &&
    selectedDestinationParticipantId !== "";

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

  const destinationPartyName = selectedDestinationParty?.entry.party.name ?? "";
  const destinationCurrentParticipantName = selectedDestinationParty?.currentParticipant.name ?? "";
  const selectedDestinationCounterpartyName = selectedDestinationCounterparty?.name ?? "";
  const activeStep = getVisibleTransferStep({
    step: state.step,
    hasSelectedDestinationParty: !!selectedDestinationParty,
    hasSelectedDestinationParticipant: !!selectedDestinationCounterparty,
  });

  const pageTitle =
    activeStep === "confirm"
      ? t`Confirm transfer`
      : activeStep === "success"
        ? t`Debt transferred`
        : t`Transfer debt`;
  const previousStep = getPreviousTransferStep({
    activeStep,
    partySelectionPrefilled: state.partySelectionPrefilled,
    participantSelectionPrefilled: state.participantSelectionPrefilled,
  });
  const onBackPress = previousStep
    ? () => {
        dispatch({ type: "stepRequested", step: previousStep });
      }
    : undefined;

  function scheduleSuccessRedirect(expenseId: string) {
    window.setTimeout(() => {
      void navigate({
        to: "/party/$partyId/expense/$expenseId",
        params: {
          partyId: party.id,
          expenseId,
        },
        replace: true,
      });
    }, 1250);
  }

  async function onConfirmTransfer() {
    if (!selectedDestinationParty || !selectedDestinationCounterparty) {
      return;
    }

    try {
      dispatch({ type: "submitStarted" });

      const { originExpense } = await transferDebtToParty({
        destinationPartyId: selectedDestinationParty.entry.party.id,
        originDebtorId: fromId,
        originCreditorId: toId,
        destinationDebtorId: selectedDestinationParty.currentParticipant.id,
        destinationCreditorId: selectedDestinationCounterparty.id,
        amount,
        paidAt: new Date(),
        originExpenseName: t`Debt transfer to another party`,
        destinationExpenseName: t`Debt transfer from another party`,
      });

      dispatch({ type: "submitSucceeded" });
      scheduleSuccessRedirect(originExpense.id);
    } catch {
      dispatch({ type: "submitFailed" });
      toast.error(t`Failed to transfer debt`);
    }
  }

  return (
    <TransferDebtLayout
      title={pageTitle}
      showBackButton={activeStep !== "success"}
      onBackPress={onBackPress}
    >
      <LazyMotion features={domAnimation}>
        <AnimatePresence initial={false} mode="wait">
          {activeStep === "success" ? (
            <m.div
              key="success"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.22 }}
            >
              <TransferSuccessState
                destinationPartyName={destinationPartyName}
                destinationCounterpartyName={selectedDestinationCounterpartyName}
                destinationDebtorName={destinationCurrentParticipantName}
              />
            </m.div>
          ) : activeStep === "confirm" ? (
            <m.div
              key="confirm"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.22 }}
            >
              <section
                aria-label={t`Confirm transfer`}
                className="container flex flex-col gap-4 px-4 pt-4"
              >
                <TransferReviewCard
                  amount={amount}
                  currency={party.currency}
                  originParty={party}
                  destinationParty={selectedDestinationParty?.entry.party}
                  from={from}
                  to={to}
                  destinationDebtor={selectedDestinationParty?.currentParticipant ?? null}
                  destinationCreditor={selectedDestinationCounterparty ?? null}
                />

                <Button
                  color="accent"
                  className="mt-2 font-semibold"
                  isDisabled={!canTransfer || state.isSubmitting}
                  onPress={() => {
                    void onConfirmTransfer();
                  }}
                >
                  {state.isSubmitting ? (
                    <>
                      <Icon
                        icon="lucide.loader-circle"
                        width={18}
                        height={18}
                        className="animate-spin"
                      />
                      <span className="ml-2">
                        <Trans>Confirming...</Trans>
                      </span>
                    </>
                  ) : (
                    <>
                      <Icon icon="lucide.check-check" width={18} height={18} />
                      <span className="ml-2">
                        <Trans>Confirm transfer</Trans>
                      </span>
                    </>
                  )}
                </Button>
              </section>
            </m.div>
          ) : activeStep === "participant" ? (
            <m.div
              key="participant"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.22 }}
            >
              <section
                aria-labelledby="transfer-debt-participant-title"
                className="container flex flex-col gap-4 px-4 pt-4 pb-24"
              >
                <SectionIntro
                  eyebrow={t`Creditor`}
                  titleId="transfer-debt-participant-title"
                  title={t`Choose who receives it`}
                />

                {destinationParticipants.length === 0 ? (
                  <InlineAlert
                    title={t`Nobody else is available in this party`}
                    description={t`This party needs another active participant besides you to receive the transferred debt.`}
                  />
                ) : (
                  <div className="divide-accent-200/80 border-accent-200/80 dark:divide-accent-800 dark:border-accent-800 dark:bg-accent-900 divide-y overflow-hidden rounded-xl border bg-white shadow-xs dark:shadow-none">
                    {orderedDestinationParticipants.map((participant) => (
                      <DestinationParticipantCard
                        key={participant.id}
                        isRecommended={priorityDestinationParticipantIds.has(participant.id)}
                        participant={participant}
                        onPress={() => {
                          dispatch({
                            type: "destinationParticipantSelected",
                            participantId: participant.id,
                          });
                        }}
                      />
                    ))}
                  </div>
                )}
              </section>
            </m.div>
          ) : (
            <m.div
              key="party"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.22 }}
            >
              <section
                aria-labelledby="transfer-debt-party-title"
                className="container flex flex-col gap-4 px-4 pt-4"
              >
                {destinationPartyOptions.length === 0 ? (
                  <InlineAlert
                    title={t`No destination party available`}
                    description={t`You need another active party with the same currency to transfer this debt.`}
                  />
                ) : (
                  <>
                    <SectionIntro
                      eyebrow={t`Destination party`}
                      titleId="transfer-debt-party-title"
                      title={t`Choose a destination party`}
                    />

                    <div className="grid gap-3">
                      {destinationPartyOptions.map((option) => (
                        <DestinationPartyCard
                          key={option.id}
                          option={option}
                          onPress={() => {
                            dispatch({
                              type: "destinationPartySelected",
                              partyId: option.id,
                              prefilledParticipantId: getPrefilledParticipantId(option),
                            });
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </section>
            </m.div>
          )}
        </AnimatePresence>
      </LazyMotion>

      {activeStep === "success" ? null : <div className="h-8 shrink-0" />}
    </TransferDebtLayout>
  );
}
