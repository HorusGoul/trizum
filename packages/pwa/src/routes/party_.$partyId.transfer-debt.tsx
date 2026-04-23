import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { Currency } from "dinero.js";
import { AnimatePresence, motion } from "motion/react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BackButton } from "#src/components/BackButton.tsx";
import { CurrencyText } from "#src/components/CurrencyText.tsx";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.ts";
import {
  type EligibleDebtTransferParty,
  useEligibleDebtTransferParties,
} from "#src/hooks/useEligibleDebtTransferParties.ts";
import { useMediaFile } from "#src/hooks/useMediaFile.ts";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import {
  getDebtTransferParticipantMatch,
  type DebtTransferParticipantMatch,
} from "#src/lib/debtTransfer.ts";
import { guardParticipatingInParty } from "#src/lib/guards.ts";
import type { Party, PartyParticipant } from "#src/models/party.ts";
import { Alert, AlertDescription, AlertTitle } from "#src/ui/Alert.tsx";
import { Avatar } from "#src/ui/Avatar.tsx";
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.tsx";
import { IconButton } from "#src/ui/IconButton.tsx";
import { cn } from "#src/ui/utils.ts";

interface TransferDebtSearchParams {
  fromId: string;
  toId: string;
  amount: number;
}

type TransferStep = "party" | "participant" | "confirm" | "success";

interface DestinationPartyOption {
  id: string;
  entry: EligibleDebtTransferParty;
  currentParticipant: PartyParticipant;
  otherParticipants: PartyParticipant[];
  participantMatch: DebtTransferParticipantMatch;
  exactMatchParticipant: PartyParticipant | null;
  recommendedParticipants: PartyParticipant[];
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

  const [destinationPartyId, setDestinationPartyId] = useState<string>("");
  const [destinationParticipantId, setDestinationParticipantId] =
    useState<string>("");
  const [step, setStep] = useState<TransferStep>("party");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successExpenseId, setSuccessExpenseId] = useState<string | null>(null);

  const destinationPartyOptions = useMemo<DestinationPartyOption[]>(() => {
    return eligibleDestinationParties.flatMap((entry) => {
      const currentDestinationParticipant =
        entry.party.participants[entry.currentParticipantId];

      if (
        !currentDestinationParticipant ||
        currentDestinationParticipant.isArchived
      ) {
        return [];
      }

      const otherParticipants = Object.values(entry.party.participants)
        .filter(
          (participant) =>
            !participant.isArchived &&
            participant.id !== currentDestinationParticipant.id,
        )
        .sort((left, right) => left.name.localeCompare(right.name));
      const participantMatch = getDebtTransferParticipantMatch({
        sourceName: to?.name ?? "",
        participants: otherParticipants,
      });
      const exactMatchParticipant =
        otherParticipants.find(
          (participant) =>
            participant.id === participantMatch.exactMatchParticipantId,
        ) ?? null;
      const recommendedParticipants = participantMatch.recommendedParticipantIds
        .map((participantId) =>
          otherParticipants.find(
            (participant) => participant.id === participantId,
          ),
        )
        .filter(
          (participant): participant is PartyParticipant => !!participant,
        );

      return [
        {
          id: entry.party.id,
          entry,
          currentParticipant: currentDestinationParticipant,
          otherParticipants,
          participantMatch,
          exactMatchParticipant,
          recommendedParticipants,
        },
      ];
    });
  }, [eligibleDestinationParties, to?.name]);

  const selectedDestinationParty = destinationPartyOptions.find(
    ({ id }) => id === destinationPartyId,
  );
  const hasPartyStep = destinationPartyOptions.length > 1;
  const destinationParticipants =
    selectedDestinationParty?.otherParticipants ?? [];
  const selectedDestinationCounterparty = destinationParticipants.find(
    (participant) => participant.id === destinationParticipantId,
  );
  const canTransfer =
    !!selectedDestinationParty &&
    !!selectedDestinationCounterparty &&
    destinationParticipantId !== "";

  useEffect(() => {
    if (destinationPartyOptions.length === 0) {
      setDestinationPartyId("");
      return;
    }

    if (
      destinationPartyId &&
      destinationPartyOptions.some((option) => option.id === destinationPartyId)
    ) {
      return;
    }

    setDestinationPartyId(
      destinationPartyOptions.length === 1 ? destinationPartyOptions[0].id : "",
    );
  }, [destinationPartyId, destinationPartyOptions]);

  useEffect(() => {
    if (!selectedDestinationParty) {
      setDestinationParticipantId("");
      return;
    }

    setDestinationParticipantId((currentValue) => {
      if (
        selectedDestinationParty.otherParticipants.some(
          (participant) => participant.id === currentValue,
        )
      ) {
        return currentValue;
      }

      return (
        selectedDestinationParty.participantMatch.exactMatchParticipantId ?? ""
      );
    });
  }, [selectedDestinationParty]);

  useEffect(() => {
    if (step === "success") {
      return;
    }

    if (!selectedDestinationParty) {
      setStep("party");
      return;
    }

    if (step === "party" && !hasPartyStep) {
      setStep("participant");
    }
  }, [hasPartyStep, selectedDestinationParty, step]);

  useEffect(() => {
    if (step === "confirm" && !canTransfer) {
      setStep(selectedDestinationParty ? "participant" : "party");
    }
  }, [canTransfer, selectedDestinationParty, step]);

  useEffect(() => {
    if (step !== "success" || !successExpenseId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void navigate({
        to: "/party/$partyId/expense/$expenseId",
        params: {
          partyId: party.id,
          expenseId: successExpenseId,
        },
        replace: true,
      });
    }, 1250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [navigate, party.id, step, successExpenseId]);

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

  const sourceCreditorName = to.name;
  const originPartyName = party.name;
  const destinationPartyName = selectedDestinationParty?.entry.party.name ?? "";
  const destinationCurrentParticipantName =
    selectedDestinationParty?.currentParticipant.name ?? "";
  const selectedDestinationCounterpartyName =
    selectedDestinationCounterparty?.name ?? "";
  const pageTitle =
    step === "confirm"
      ? t`Confirm transfer`
      : step === "success"
        ? t`Debt transferred`
        : t`Transfer debt`;
  const participantStepDescription = selectedDestinationParty
    ? t`In ${destinationPartyName}, ${destinationCurrentParticipantName} will owe the selected person.`
    : t`Choose who should be owed after the transfer.`;
  const reviewStepDescription = t`This will settle the debt in ${originPartyName} and recreate it in ${destinationPartyName}.`;
  const onBackPress =
    step === "confirm"
      ? () => {
          setStep("participant");
        }
      : step === "participant" && hasPartyStep
        ? () => {
            setStep("party");
          }
        : undefined;

  async function onConfirmTransfer() {
    if (!selectedDestinationParty || !selectedDestinationCounterparty) {
      return;
    }

    try {
      setIsSubmitting(true);

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

      setSuccessExpenseId(originExpense.id);
      setStep("success");
    } catch {
      setIsSubmitting(false);
      toast.error(t`Failed to transfer debt`);
    }
  }

  return (
    <TransferDebtLayout
      title={pageTitle}
      showBackButton={step !== "success"}
      onBackPress={onBackPress}
    >
      {step === "party" || step === "participant" ? (
        <div className="container px-4 pt-4">
          <DebtSummaryCard
            currency={party.currency}
            fromName={from.name}
            toName={to.name}
            amount={amount}
          />
        </div>
      ) : null}

      {step !== "success" ? (
        <div className="container px-4 pt-4">
          <TransferStepIndicator step={step} hasPartyStep={hasPartyStep} />
        </div>
      ) : null}

      <AnimatePresence initial={false} mode="wait">
        {step === "success" ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.22 }}
            data-testid="transfer-debt-success-step"
          >
            <TransferSuccessState
              destinationPartyName={destinationPartyName}
              destinationCounterpartyName={selectedDestinationCounterpartyName}
              destinationDebtorName={destinationCurrentParticipantName}
            />
          </motion.div>
        ) : step === "confirm" ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.22 }}
            data-testid="transfer-debt-confirmation-step"
          >
            <div className="container flex flex-col gap-4 px-4 pt-4">
              <SectionIntro
                eyebrow={t`Review`}
                title={t`Confirm transfer`}
                description={reviewStepDescription}
              />

              <TransferReviewCard
                amount={amount}
                currency={party.currency}
                fromName={from.name}
                toName={to.name}
                originParty={party}
                destinationParty={selectedDestinationParty?.entry.party}
                destinationDebtorName={destinationCurrentParticipantName}
                destinationCreditorName={selectedDestinationCounterpartyName}
              />

              <div className="mt-2">
                <Button
                  color="accent"
                  className="w-full font-semibold"
                  isDisabled={!canTransfer || isSubmitting}
                  onPress={() => {
                    void onConfirmTransfer();
                  }}
                >
                  {isSubmitting ? (
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
              </div>
            </div>
          </motion.div>
        ) : step === "participant" ? (
          <motion.div
            key="participant"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.22 }}
            data-testid="transfer-debt-participant-step"
          >
            <div className="container flex flex-col gap-4 px-4 pt-4">
              <SectionIntro
                eyebrow={t`Creditor`}
                title={t`Choose who receives it`}
                description={participantStepDescription}
              />

              {destinationParticipants.length === 0 ? (
                <InlineAlert
                  title={t`Nobody else is available in this party`}
                  description={t`This party needs another active participant besides you to receive the transferred debt.`}
                />
              ) : (
                <div className="grid gap-3">
                  {destinationParticipants.map((participant) => (
                    <DestinationParticipantCard
                      key={participant.id}
                      isRecommended={
                        selectedDestinationParty?.recommendedParticipants.some(
                          (candidate) => candidate.id === participant.id,
                        ) ?? false
                      }
                      isExactMatch={
                        selectedDestinationParty?.exactMatchParticipant?.id ===
                        participant.id
                      }
                      isSelected={participant.id === destinationParticipantId}
                      participant={participant}
                      onPress={() => {
                        setDestinationParticipantId(participant.id);
                      }}
                    />
                  ))}
                </div>
              )}

              <Button
                color="accent"
                className="mt-2 font-semibold"
                isDisabled={!canTransfer}
                onPress={() => {
                  setStep("confirm");
                }}
              >
                <Icon icon="lucide.chevrons-right" width={18} height={18} />
                <span className="ml-2">
                  <Trans>Continue</Trans>
                </span>
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="party"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.22 }}
            data-testid="transfer-debt-party-step"
          >
            <div className="container flex flex-col gap-4 px-4 pt-4">
              {destinationPartyOptions.length === 0 ? (
                <InlineAlert
                  title={t`No destination party available`}
                  description={t`You need another active party with the same currency to transfer this debt.`}
                />
              ) : (
                <>
                  <SectionIntro
                    eyebrow={t`Destination party`}
                    title={t`Choose a destination party`}
                    description={t`Move this debt into one of your other active parties.`}
                  />

                  <div className="grid gap-3">
                    {destinationPartyOptions.map((option) => (
                      <DestinationPartyCard
                        key={option.id}
                        option={option}
                        isSelected={option.id === destinationPartyId}
                        sourceCreditorName={sourceCreditorName}
                        onPress={() => {
                          setDestinationPartyId(option.id);
                          setStep("participant");
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {step === "success" ? null : <div className="h-16 flex-shrink-0" />}
    </TransferDebtLayout>
  );
}

function TransferDebtLayout({
  title,
  children,
  showBackButton = true,
  onBackPress,
}: {
  title: string;
  children: React.ReactNode;
  showBackButton?: boolean;
  onBackPress?: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2 mt-safe">
        {showBackButton ? (
          onBackPress ? (
            <IconButton
              icon="lucide.arrow-left"
              aria-label={t`Go Back`}
              className="flex-shrink-0"
              onPress={onBackPress}
            />
          ) : (
            <BackButton fallbackOptions={{ to: "/party/$partyId" }} />
          )
        ) : (
          <div className="h-10 w-10 flex-shrink-0" />
        )}
        <h1 className="max-h-12 truncate px-4 text-xl font-medium">{title}</h1>
      </div>

      {children}
    </div>
  );
}

function TransferStepIndicator({
  step,
  hasPartyStep,
}: {
  step: Exclude<TransferStep, "success">;
  hasPartyStep: boolean;
}) {
  const totalSteps = hasPartyStep ? 3 : 2;
  const currentStep =
    step === "party"
      ? 1
      : step === "participant"
        ? hasPartyStep
          ? 2
          : 1
        : totalSteps;
  const currentStepLabel =
    step === "party"
      ? t`Choose a party`
      : step === "participant"
        ? t`Choose a person`
        : t`Confirm`;

  return (
    <div className="flex items-center gap-3 rounded-full border border-accent-200/80 bg-white px-3 py-2 text-sm font-medium text-accent-700 shadow-sm dark:border-accent-800 dark:bg-accent-900 dark:text-accent-300 dark:shadow-none">
      <span className="rounded-full bg-accent-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent-900 dark:bg-accent-800 dark:text-accent-50">
        <Trans>
          Step {currentStep} of {totalSteps}
        </Trans>
      </span>
      <span className="h-1.5 w-1.5 rounded-full bg-accent-300 dark:bg-accent-700" />
      <span>{currentStepLabel}</span>
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-500 dark:text-accent-400">
        {eyebrow}
      </div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-accent-800 dark:text-accent-200">
        {description}
      </p>
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
    <div className="flex rounded-3xl border border-accent-200/80 bg-gradient-to-br from-accent-100 via-white to-accent-50 p-5 shadow-sm dark:border-accent-800 dark:from-accent-950 dark:via-accent-950 dark:to-accent-900 dark:shadow-none">
      <div className="flex flex-1 flex-col">
        <span className="text-lg text-accent-600 dark:text-accent-300">
          {fromName}
        </span>
        <span className="text-sm uppercase tracking-[0.18em] text-accent-500 dark:text-accent-400">
          <Trans>owes</Trans>
        </span>
        <span className="text-lg text-accent-900 dark:text-accent-50">
          {toName}
        </span>
      </div>

      <div className="flex flex-shrink-0 items-center">
        <CurrencyText
          currency={currency}
          amount={amount}
          className="text-2xl"
        />
      </div>
    </div>
  );
}

function DestinationPartyCard({
  option,
  isSelected,
  sourceCreditorName,
  onPress,
}: {
  option: DestinationPartyOption;
  isSelected: boolean;
  sourceCreditorName: string;
  onPress: () => void;
}) {
  const topRecommendation = option.recommendedParticipants[0] ?? null;
  const currentParticipantName = option.currentParticipant.name;
  const exactMatchParticipantName = option.exactMatchParticipant?.name ?? "";
  const topRecommendationName = topRecommendation?.name ?? "";

  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-3xl border p-4 text-left transition-all duration-200",
        isSelected
          ? "border-accent-500 bg-accent-50 shadow-sm dark:border-accent-400 dark:bg-accent-950"
          : "border-accent-200/80 bg-white hover:border-accent-300 hover:bg-accent-50/70 dark:border-accent-800 dark:bg-accent-900 dark:hover:border-accent-700 dark:hover:bg-accent-950",
      )}
      onClick={onPress}
    >
      <div className="flex items-start gap-4">
        <PartySymbolBadge party={option.entry.party} className="h-12 w-12" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-accent-950 dark:text-accent-50">
                {option.entry.party.name}
              </div>
              {option.entry.party.description ? (
                <p className="mt-1 line-clamp-2 text-sm text-accent-700 dark:text-accent-300">
                  {option.entry.party.description}
                </p>
              ) : null}
            </div>

            {isSelected ? (
              <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-500 text-accent-50 dark:bg-accent-400 dark:text-accent-950">
                <Icon icon="lucide.check" width={16} height={16} />
              </span>
            ) : null}
          </div>

          <div className="mt-3 text-sm text-accent-700 dark:text-accent-300">
            <Trans>You are {currentParticipantName}</Trans>
          </div>

          <div className="mt-3 rounded-2xl border border-accent-200/80 bg-accent-50/80 px-3 py-2 text-sm dark:border-accent-800 dark:bg-accent-950/70">
            {option.exactMatchParticipant ? (
              <Trans>
                Best match for {sourceCreditorName}:{" "}
                <span className="font-semibold">
                  {exactMatchParticipantName}
                </span>
              </Trans>
            ) : topRecommendation ? (
              <Trans>
                Best match for {sourceCreditorName}:{" "}
                <span className="font-semibold">{topRecommendationName}</span>
              </Trans>
            ) : (
              <Trans>Choose the person on the next step</Trans>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function DestinationParticipantCard({
  participant,
  isSelected,
  isRecommended,
  isExactMatch,
  onPress,
}: {
  participant: PartyParticipant;
  isSelected: boolean;
  isRecommended: boolean;
  isExactMatch: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-3xl border p-4 text-left transition-all duration-200",
        isSelected
          ? "border-accent-500 bg-accent-50 shadow-sm dark:border-accent-400 dark:bg-accent-950"
          : "border-accent-200/80 bg-white hover:border-accent-300 hover:bg-accent-50/70 dark:border-accent-800 dark:bg-accent-900 dark:hover:border-accent-700 dark:hover:bg-accent-950",
      )}
      onClick={onPress}
    >
      <div className="flex items-center gap-4">
        <TransferParticipantAvatar
          participant={participant}
          className="h-12 w-12 text-sm shadow-sm"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-accent-950 dark:text-accent-50">
                {participant.name}
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                {isExactMatch ? (
                  <InfoPill tone="accent">
                    <Icon icon="lucide.sparkles" width={12} height={12} />
                    <span>
                      <Trans>Exact match</Trans>
                    </span>
                  </InfoPill>
                ) : null}

                {!isExactMatch && isRecommended ? (
                  <InfoPill>
                    <Icon icon="lucide.badge-plus" width={12} height={12} />
                    <span>
                      <Trans>Recommended</Trans>
                    </span>
                  </InfoPill>
                ) : null}
              </div>
            </div>

            {isSelected ? (
              <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-500 text-accent-50 dark:bg-accent-400 dark:text-accent-950">
                <Icon icon="lucide.check" width={16} height={16} />
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}

function TransferReviewCard({
  amount,
  currency,
  fromName,
  toName,
  originParty,
  destinationParty,
  destinationDebtorName,
  destinationCreditorName,
}: {
  amount: number;
  currency: Currency;
  fromName: string;
  toName: string;
  originParty: Party;
  destinationParty?: Party;
  destinationDebtorName: string;
  destinationCreditorName: string;
}) {
  return (
    <div className="rounded-3xl border border-accent-200/80 bg-gradient-to-br from-white via-accent-50 to-accent-100 p-5 shadow-sm dark:border-accent-800 dark:from-accent-950 dark:via-accent-950 dark:to-accent-900 dark:shadow-none">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-accent-700 dark:text-accent-300">
            <Trans>Debt being moved</Trans>
          </div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">
            {fromName} <span className="text-accent-500">→</span> {toName}
          </div>
        </div>

        <CurrencyText
          currency={currency}
          amount={amount}
          className="text-2xl font-semibold"
        />
      </div>

      <div className="mt-5 grid gap-3">
        <ReviewPartyRow
          caption={t`Settled in`}
          party={originParty}
          detail={
            <Trans>
              {fromName} stops owing {toName}
            </Trans>
          }
        />

        {destinationParty ? (
          <ReviewPartyRow
            caption={t`Recreated in`}
            party={destinationParty}
            detail={
              <Trans>
                {destinationCreditorName} is owed by {destinationDebtorName}
              </Trans>
            }
          />
        ) : null}
      </div>
    </div>
  );
}

function ReviewPartyRow({
  caption,
  party,
  detail,
}: {
  caption: string;
  party: Party;
  detail: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-accent-200/80 bg-white/80 p-3 dark:border-accent-800 dark:bg-accent-950/70">
      <PartySymbolBadge party={party} className="h-11 w-11" />

      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-500 dark:text-accent-400">
          {caption}
        </div>
        <div className="mt-1 text-base font-semibold text-accent-950 dark:text-accent-50">
          {party.name}
        </div>
        <div className="mt-1 text-sm text-accent-700 dark:text-accent-300">
          {detail}
        </div>
      </div>
    </div>
  );
}

function TransferSuccessState({
  destinationPartyName,
  destinationCounterpartyName,
  destinationDebtorName,
}: {
  destinationPartyName: string;
  destinationCounterpartyName: string;
  destinationDebtorName: string;
}) {
  return (
    <div className="container flex flex-1 flex-col items-center justify-center px-6 text-center pt-safe-offset-24">
      <div className="relative">
        <motion.div
          className="absolute inset-0 rounded-full bg-success-500/20"
          animate={{ scale: [1, 1.35, 1], opacity: [0.25, 0.05, 0.25] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />

        <motion.div
          className="relative flex h-24 w-24 items-center justify-center rounded-full bg-success-500 text-success-50 shadow-lg dark:shadow-none"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 18 }}
        >
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.12, type: "spring", stiffness: 320 }}
          >
            <Icon icon="lucide.check" width={40} height={40} />
          </motion.div>
        </motion.div>
      </div>

      <h2 className="mt-8 text-3xl font-semibold tracking-tight">
        <Trans>Debt transferred</Trans>
      </h2>

      <p className="mt-3 max-w-sm text-sm leading-6 text-accent-800 dark:text-accent-200">
        <Trans>
          The new debt is now in{" "}
          <span className="font-semibold">{destinationPartyName}</span>, where{" "}
          <span className="font-semibold">{destinationCounterpartyName}</span>{" "}
          is owed by{" "}
          <span className="font-semibold">{destinationDebtorName}</span>.
        </Trans>
      </p>

      <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-accent-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent-600 dark:border-accent-800 dark:bg-accent-900 dark:text-accent-300">
        <Icon icon="lucide.sparkles" width={14} height={14} />
        <Trans>Opening updated expense…</Trans>
      </div>
    </div>
  );
}

function TransferParticipantAvatar({
  participant,
  className,
}: {
  participant: PartyParticipant;
  className?: string;
}) {
  if (!participant.avatarId) {
    return <Avatar className={className} name={participant.name} />;
  }

  return (
    <Suspense
      fallback={<Avatar className={className} name={participant.name} />}
    >
      <TransferParticipantAvatarImage
        avatarId={participant.avatarId}
        className={className}
        name={participant.name}
      />
    </Suspense>
  );
}

function TransferParticipantAvatarImage({
  avatarId,
  name,
  className,
}: {
  avatarId: NonNullable<PartyParticipant["avatarId"]>;
  name: string;
  className?: string;
}) {
  const { url } = useMediaFile(avatarId);

  return <Avatar className={className} name={name} url={url} />;
}

function PartySymbolBadge({
  party,
  className,
}: {
  party: Party;
  className?: string;
}) {
  const symbol = party.symbol || party.name.charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-accent-200 bg-accent-950 text-lg font-semibold text-white dark:border-accent-700/20 dark:bg-black/20 dark:text-accent-50",
        className,
      )}
    >
      <span className="pt-0.5">{symbol}</span>
    </div>
  );
}

function InfoPill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "accent" | "default";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        tone === "accent"
          ? "border-accent-300 bg-accent-100 text-accent-900 dark:border-accent-700 dark:bg-accent-800 dark:text-accent-50"
          : "border-accent-200 bg-white text-accent-700 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-300",
      )}
    >
      {children}
    </span>
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
