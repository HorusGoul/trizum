import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
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
import { cn } from "#src/ui/utils.ts";

interface TransferDebtSearchParams {
  fromId: string;
  toId: string;
  amount: number;
}

type TransferStep = "configure" | "confirm" | "success";

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
  const [dismissedRecommendationIds, setDismissedRecommendationIds] = useState<
    string[]
  >([]);
  const [step, setStep] = useState<TransferStep>("configure");
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
  const destinationParticipants =
    selectedDestinationParty?.otherParticipants ?? [];
  const selectedDestinationCounterparty = destinationParticipants.find(
    (participant) => participant.id === destinationParticipantId,
  );
  const displayedRecommendedParticipants =
    selectedDestinationParty?.recommendedParticipants.filter(
      (participant) => !dismissedRecommendationIds.includes(participant.id),
    ) ?? [];
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
      setDismissedRecommendationIds([]);
      return;
    }

    setDismissedRecommendationIds([]);
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
    if (step !== "configure" && !canTransfer) {
      setStep("configure");
    }
  }, [canTransfer, step]);

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
  const selectedExactMatchParticipantName =
    selectedDestinationParty?.exactMatchParticipant?.name ?? "";
  const pageTitle =
    step === "confirm"
      ? t`Confirm transfer`
      : step === "success"
        ? t`Debt transferred`
        : t`Transfer debt`;

  function handleRecommendationPress(participantId: string) {
    setDestinationParticipantId(participantId);
    setDismissedRecommendationIds((currentValue) =>
      currentValue.includes(participantId)
        ? currentValue
        : [...currentValue, participantId],
    );
  }

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
    <TransferDebtLayout title={pageTitle} showBackButton={step !== "success"}>
      <div className="container px-4 pt-4">
        <DebtSummaryCard
          currency={party.currency}
          fromName={from.name}
          toName={to.name}
          amount={amount}
        />
      </div>

      <div className="container px-4 pt-4">
        <TransferStepIndicator step={step} />
      </div>

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
                title={t`Confirm this transfer`}
                description={t`Check the parties and participants before creating the two expenses.`}
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

              <div className="rounded-3xl border border-accent-200/80 bg-white p-4 shadow-sm dark:border-accent-800 dark:bg-accent-900 dark:shadow-none">
                <div className="flex items-center gap-2 text-sm font-medium text-accent-700 dark:text-accent-300">
                  <Icon icon="lucide.receipt-text" width={16} height={16} />
                  <span>
                    <Trans>Expenses that will be created</Trans>
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
                  <ExpensePreviewCard
                    label={t`Origin party`}
                    partyName={originPartyName}
                    expenseName={t`Debt transfer to another party`}
                    detail={t`Settles the current debt`}
                  />
                  <ExpensePreviewCard
                    label={t`Destination party`}
                    partyName={destinationPartyName}
                    expenseName={t`Debt transfer from another party`}
                    detail={t`Creates the same debt in the selected party`}
                  />
                </div>
              </div>

              <div className="mt-2 flex gap-3">
                <Button
                  color="input-like"
                  className="flex-1 font-semibold"
                  onPress={() => {
                    setStep("configure");
                  }}
                >
                  <Trans>Back</Trans>
                </Button>

                <Button
                  color="accent"
                  className="flex-1 font-semibold"
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
        ) : (
          <motion.div
            key="configure"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.22 }}
            data-testid="transfer-debt-selection-step"
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
                    eyebrow={t`Step 1`}
                    title={t`Choose where the debt should continue`}
                    description={t`Parties show your identity there and the best match we can find for ${sourceCreditorName}.`}
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
                        }}
                      />
                    ))}
                  </div>

                  {selectedDestinationParty ? (
                    <>
                      <SectionIntro
                        eyebrow={t`Step 2`}
                        title={t`Choose who receives the debt there`}
                        description={t`Pick the person in ${destinationPartyName} who should be owed after the transfer.`}
                      />

                      {selectedDestinationParty.exactMatchParticipant ? (
                        <InfoPill>
                          <Icon icon="lucide.sparkles" width={14} height={14} />
                          <span>
                            <Trans>
                              Exact name match selected automatically:{" "}
                              {selectedExactMatchParticipantName}
                            </Trans>
                          </span>
                        </InfoPill>
                      ) : null}

                      {displayedRecommendedParticipants.length > 0 ? (
                        <div className="rounded-3xl border border-accent-200/80 bg-white p-4 shadow-sm dark:border-accent-800 dark:bg-accent-900 dark:shadow-none">
                          <div className="text-sm font-medium text-accent-700 dark:text-accent-300">
                            <Trans>Quick recommendations</Trans>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <AnimatePresence initial={false}>
                              {displayedRecommendedParticipants.map(
                                (participant) => (
                                  <motion.button
                                    key={participant.id}
                                    type="button"
                                    layout
                                    initial={{ opacity: 0, scale: 0.92 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.92 }}
                                    transition={{ duration: 0.15 }}
                                    className="inline-flex w-auto items-center gap-2 rounded-full border border-accent-300 bg-accent-50 px-2.5 py-1.5 text-xs font-semibold text-accent-900 transition-colors hover:border-accent-400 hover:bg-accent-100 dark:border-accent-700 dark:bg-accent-950 dark:text-accent-100 dark:hover:border-accent-600 dark:hover:bg-accent-900"
                                    onClick={() => {
                                      handleRecommendationPress(participant.id);
                                    }}
                                  >
                                    <TransferParticipantAvatar
                                      participant={participant}
                                      className="h-5 w-5 text-[9px]"
                                    />
                                    <span>{participant.name}</span>
                                  </motion.button>
                                ),
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      ) : null}

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
                              isRecommended={selectedDestinationParty.recommendedParticipants.some(
                                (candidate) => candidate.id === participant.id,
                              )}
                              isExactMatch={
                                selectedDestinationParty.exactMatchParticipant
                                  ?.id === participant.id
                              }
                              isSelected={
                                participant.id === destinationParticipantId
                              }
                              participant={participant}
                              onPress={() => {
                                setDestinationParticipantId(participant.id);
                              }}
                            />
                          ))}
                        </div>
                      )}

                      {selectedDestinationCounterparty ? (
                        <div className="rounded-3xl border border-accent-200/80 bg-gradient-to-br from-accent-50 to-white p-5 shadow-sm dark:border-accent-800 dark:from-accent-950 dark:to-accent-900 dark:shadow-none">
                          <div className="flex items-center gap-2 text-sm font-medium text-accent-700 dark:text-accent-300">
                            <Icon
                              icon="lucide.arrow-right-left"
                              width={16}
                              height={16}
                            />
                            <span>
                              <Trans>Preview</Trans>
                            </span>
                          </div>

                          <p className="mt-3 leading-7">
                            <Trans>
                              This will settle the debt in{" "}
                              <span className="font-semibold">
                                {originPartyName}
                              </span>{" "}
                              and recreate it in{" "}
                              <span className="font-semibold">
                                {destinationPartyName}
                              </span>
                              , where{" "}
                              <span className="font-semibold">
                                {selectedDestinationCounterpartyName}
                              </span>{" "}
                              will be owed by{" "}
                              <span className="font-semibold">
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
                        onPress={() => {
                          setStep("confirm");
                        }}
                      >
                        <Icon
                          icon="lucide.chevrons-right"
                          width={18}
                          height={18}
                        />
                        <span className="ml-2">
                          <Trans>Review transfer</Trans>
                        </span>
                      </Button>
                    </>
                  ) : null}
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
}: {
  title: string;
  children: React.ReactNode;
  showBackButton?: boolean;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2 mt-safe">
        {showBackButton ? (
          <BackButton fallbackOptions={{ to: "/party/$partyId" }} />
        ) : (
          <div className="h-10 w-10 flex-shrink-0" />
        )}
        <h1 className="max-h-12 truncate px-4 text-xl font-medium">{title}</h1>
      </div>

      {children}
    </div>
  );
}

function TransferStepIndicator({ step }: { step: TransferStep }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-accent-200/80 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent-700 shadow-sm dark:border-accent-800 dark:bg-accent-900 dark:text-accent-300 dark:shadow-none">
      <StepDot isActive={step !== "success"} label={t`Choose`} />
      <span className="opacity-40">/</span>
      <StepDot
        isActive={step === "confirm" || step === "success"}
        label={t`Review`}
      />
      <span className="opacity-40">/</span>
      <StepDot isActive={step === "success"} label={t`Done`} />
    </div>
  );
}

function StepDot({ isActive, label }: { isActive: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-2 py-1 transition-colors",
        isActive
          ? "bg-accent-100 text-accent-950 dark:bg-accent-800 dark:text-accent-50"
          : "text-accent-500 dark:text-accent-500",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isActive
            ? "bg-accent-500 dark:bg-accent-300"
            : "bg-accent-300 dark:bg-accent-700",
        )}
      />
      {label}
    </span>
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

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-accent-700 dark:text-accent-300">
            <InfoPill>
              <Icon icon="lucide.user-round" width={12} height={12} />
              <span>
                <Trans>You are {currentParticipantName}</Trans>
              </span>
            </InfoPill>

            <InfoPill>
              <Icon icon="lucide.users" width={12} height={12} />
              <span>
                <Plural
                  value={option.otherParticipants.length}
                  one="# possible creditor"
                  other="# possible creditors"
                />
              </span>
            </InfoPill>
          </div>

          <div className="mt-4 rounded-2xl border border-accent-200/80 bg-accent-50/80 px-3 py-2 text-sm dark:border-accent-800 dark:bg-accent-950/70">
            {option.exactMatchParticipant ? (
              <Trans>
                Best match for {sourceCreditorName}:{" "}
                <span className="font-semibold">
                  {exactMatchParticipantName}
                </span>
              </Trans>
            ) : topRecommendation ? (
              <Trans>
                Likely match for {sourceCreditorName}:{" "}
                <span className="font-semibold">{topRecommendationName}</span>
              </Trans>
            ) : (
              <Trans>No obvious match for {sourceCreditorName} yet</Trans>
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

                {isSelected ? (
                  <InfoPill tone="accent">
                    <Icon icon="lucide.check" width={12} height={12} />
                    <span>
                      <Trans>Selected</Trans>
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

function ExpensePreviewCard({
  label,
  partyName,
  expenseName,
  detail,
}: {
  label: string;
  partyName: string;
  expenseName: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-accent-200/80 bg-accent-50/60 p-4 dark:border-accent-800 dark:bg-accent-950/70">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-500 dark:text-accent-400">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-accent-950 dark:text-accent-50">
        {partyName}
      </div>
      <div className="mt-2 text-sm font-medium text-accent-800 dark:text-accent-200">
        {expenseName}
      </div>
      <div className="mt-1 text-sm text-accent-700 dark:text-accent-300">
        {detail}
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
