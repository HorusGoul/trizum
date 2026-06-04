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

  const defaultDestinationPartyId =
    destinationPartyOptions.length === 1
      ? (destinationPartyOptions[0]?.id ?? "")
      : "";
  const hasSelectedDestinationParty = destinationPartyOptions.some(
    ({ id }) => id === destinationPartyId,
  );
  const selectedDestinationPartyId = hasSelectedDestinationParty
    ? destinationPartyId
    : defaultDestinationPartyId;
  const selectedDestinationParty = destinationPartyOptions.find(
    ({ id }) => id === selectedDestinationPartyId,
  );
  const hasPartyStep = destinationPartyOptions.length > 1;
  const destinationParticipants =
    selectedDestinationParty?.otherParticipants ?? [];
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
    ...destinationParticipants.filter(
      ({ id }) => !priorityDestinationParticipantIds.has(id),
    ),
  ];
  const defaultDestinationParticipantId =
    destinationParticipants.length === 1
      ? (destinationParticipants[0]?.id ?? "")
      : "";
  const hasSelectedDestinationParticipant = destinationParticipants.some(
    ({ id }) => id === destinationParticipantId,
  );
  const selectedDestinationParticipantId = hasSelectedDestinationParticipant
    ? destinationParticipantId
    : defaultDestinationParticipantId;
  const hasParticipantStep = destinationParticipants.length !== 1;
  const selectedDestinationCounterparty = destinationParticipants.find(
    (participant) => participant.id === selectedDestinationParticipantId,
  );
  const canTransfer =
    !!selectedDestinationParty &&
    !!selectedDestinationCounterparty &&
    selectedDestinationParticipantId !== "";

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

  const destinationPartyName = selectedDestinationParty?.entry.party.name ?? "";
  const destinationCurrentParticipantName =
    selectedDestinationParty?.currentParticipant.name ?? "";
  const selectedDestinationCounterpartyName =
    selectedDestinationCounterparty?.name ?? "";
  let activeStep: TransferStep;

  if (step === "success") {
    activeStep = "success";
  } else if (step === "party" && hasPartyStep) {
    activeStep = "party";
  } else if (!selectedDestinationParty) {
    activeStep = "party";
  } else if (step === "confirm" && !canTransfer) {
    activeStep = hasParticipantStep ? "participant" : "party";
  } else if (!hasParticipantStep) {
    activeStep = "confirm";
  } else if (step === "party") {
    activeStep = "participant";
  } else {
    activeStep = step;
  }

  const pageTitle =
    activeStep === "confirm"
      ? t`Confirm transfer`
      : activeStep === "success"
        ? t`Debt transferred`
        : t`Transfer debt`;
  const onBackPress =
    activeStep === "confirm" && hasParticipantStep
      ? () => {
          setStep("participant");
        }
      : activeStep === "confirm" && hasPartyStep
        ? () => {
            setStep("party");
          }
        : activeStep === "participant" && hasPartyStep
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
      showBackButton={activeStep !== "success"}
      onBackPress={onBackPress}
    >
      <AnimatePresence initial={false} mode="wait">
        {activeStep === "success" ? (
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
        ) : activeStep === "confirm" ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.22 }}
            data-testid="transfer-debt-confirmation-step"
          >
            <div className="container flex flex-col gap-4 px-4 pt-4">
              <TransferReviewCard
                amount={amount}
                currency={party.currency}
                originParty={party}
                destinationParty={selectedDestinationParty?.entry.party}
                from={from}
                to={to}
                destinationDebtor={
                  selectedDestinationParty?.currentParticipant ?? null
                }
                destinationCreditor={selectedDestinationCounterparty ?? null}
              />

              <Button
                color="accent"
                className="mt-2 font-semibold"
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
          </motion.div>
        ) : activeStep === "participant" ? (
          <motion.div
            key="participant"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.22 }}
            data-testid="transfer-debt-participant-step"
          >
            <div className="container flex flex-col gap-4 px-4 pb-24 pt-4">
              <SectionIntro
                eyebrow={t`Creditor`}
                title={t`Choose who receives it`}
              />

              {destinationParticipants.length === 0 ? (
                <InlineAlert
                  title={t`Nobody else is available in this party`}
                  description={t`This party needs another active participant besides you to receive the transferred debt.`}
                />
              ) : (
                <div className="divide-y divide-accent-200/80 overflow-hidden rounded-xl border border-accent-200/80 bg-white shadow-sm dark:divide-accent-800 dark:border-accent-800 dark:bg-accent-900 dark:shadow-none">
                  {orderedDestinationParticipants.map((participant) => (
                    <DestinationParticipantCard
                      key={participant.id}
                      isRecommended={priorityDestinationParticipantIds.has(
                        participant.id,
                      )}
                      participant={participant}
                      onPress={() => {
                        setDestinationParticipantId(participant.id);
                        setStep("confirm");
                      }}
                    />
                  ))}
                </div>
              )}
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
                  />

                  <div className="grid gap-3">
                    {destinationPartyOptions.map((option) => (
                      <DestinationPartyCard
                        key={option.id}
                        option={option}
                        onPress={() => {
                          setDestinationPartyId(option.id);
                          setDestinationParticipantId("");
                          setStep(
                            option.otherParticipants.length === 1
                              ? "confirm"
                              : "participant",
                          );
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

      {activeStep === "success" ? null : <div className="h-8 flex-shrink-0" />}
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

function SectionIntro({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-500 dark:text-accent-400">
        {eyebrow}
      </div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
    </div>
  );
}

function DestinationPartyCard({
  option,
  onPress,
}: {
  option: DestinationPartyOption;
  onPress: () => void;
}) {
  const participantPreview = getParticipantPreview(option.otherParticipants);
  const description = option.entry.party.description.trim();
  const hasDescription = description.length > 0;
  const hasSupportingCopy = hasDescription || participantPreview !== null;

  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-xl border p-4 text-left shadow-sm transition-all duration-200 ease-in-out",
        "border-accent-200/80 bg-gradient-to-br from-white via-white to-accent-50/80 active:scale-[0.99] hover:border-accent-300/90 hover:shadow-md focus-visible:border-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/20 dark:border-accent-800 dark:from-accent-950 dark:via-accent-950 dark:to-accent-900/70 dark:shadow-none dark:hover:border-accent-700 dark:focus-visible:border-accent-500",
      )}
      onClick={onPress}
    >
      <div
        className={cn(
          "flex gap-4",
          hasSupportingCopy ? "items-start" : "items-center",
        )}
      >
        <PartySymbolBadge
          party={option.entry.party}
          className="mt-1 h-12 w-12 text-xl shadow-sm"
        />

        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold tracking-tight text-accent-950 dark:text-accent-50">
            {option.entry.party.name}
          </div>
          {participantPreview ? (
            <p className="mt-1 flex min-w-0 items-start gap-2 text-sm leading-6 text-accent-900/80 dark:text-accent-200">
              <Icon
                icon="lucide.users"
                width={16}
                height={16}
                aria-hidden="true"
                className="mt-1 flex-shrink-0 opacity-90"
              />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block sm:hidden">
                  <ParticipantPreviewText preview={participantPreview.mobile} />
                </span>
                <span className="line-clamp-1 hidden sm:block">
                  <ParticipantPreviewText
                    preview={participantPreview.desktop}
                  />
                </span>
              </span>
            </p>
          ) : null}
          {hasDescription ? (
            <p className="mt-1 line-clamp-2 text-sm italic leading-6 text-accent-900 dark:text-accent-100/80">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function ParticipantPreviewText({
  preview,
}: {
  preview: {
    names: string;
    remainingCount: number;
  };
}) {
  return (
    <>
      {preview.names}
      {preview.remainingCount > 0 ? (
        <>
          {" "}
          <Plural
            value={preview.remainingCount}
            one="and # other"
            other="and # others"
          />
        </>
      ) : null}
    </>
  );
}

function getParticipantPreview(participants: PartyParticipant[]) {
  const visibleParticipantNames = participants
    .filter(
      (participant) =>
        !participant.isArchived && participant.name.trim() !== "",
    )
    .map((participant) => participant.name.trim());

  if (visibleParticipantNames.length === 0) {
    return null;
  }

  return {
    mobile: getParticipantPreviewVariant(visibleParticipantNames, 2),
    desktop: getParticipantPreviewVariant(visibleParticipantNames, 3),
  };
}

function getParticipantPreviewVariant(
  visibleParticipantNames: string[],
  maxNames: number,
) {
  const previewNames = visibleParticipantNames.slice(0, maxNames);

  return {
    names: previewNames.join(", "),
    remainingCount: visibleParticipantNames.length - previewNames.length,
  };
}

function DestinationParticipantCard({
  participant,
  isRecommended,
  onPress,
}: {
  participant: PartyParticipant;
  isRecommended: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-200",
        "hover:bg-accent-50 focus-visible:bg-accent-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500/30 dark:hover:bg-accent-950 dark:focus-visible:bg-accent-950",
      )}
      onClick={onPress}
    >
      <div className="relative flex-shrink-0">
        <TransferParticipantAvatar
          participant={participant}
          className="h-9 w-9 text-xs shadow-sm"
        />
        {isRecommended ? (
          <span
            aria-label={t`Recommended match`}
            className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-accent-500 text-accent-50 shadow-sm dark:border-accent-900 dark:bg-accent-400 dark:text-accent-950"
          >
            <Icon icon="lucide.sparkles" width={9} height={9} />
          </span>
        ) : null}
      </div>

      <span className="min-w-0 flex-1 truncate text-base font-medium text-accent-950 dark:text-accent-50">
        {participant.name}
      </span>
    </button>
  );
}

function TransferReviewCard({
  amount,
  currency,
  originParty,
  destinationParty,
  from,
  to,
  destinationDebtor,
  destinationCreditor,
}: {
  amount: number;
  currency: Currency;
  originParty: Party;
  destinationParty?: Party;
  from: PartyParticipant;
  to: PartyParticipant;
  destinationDebtor: PartyParticipant | null;
  destinationCreditor: PartyParticipant | null;
}) {
  const fromName = from.name;
  const toName = to.name;
  const destinationDebtorName = destinationDebtor?.name ?? "";
  const destinationCreditorName = destinationCreditor?.name ?? "";

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-accent-700 dark:text-accent-300">
            <Trans>Debt being moved</Trans>
          </div>
          <div className="mt-1 text-xl font-semibold tracking-tight">
            {fromName} <span className="text-accent-500">→</span> {toName}
          </div>
        </div>

        <CurrencyText
          currency={currency}
          amount={amount}
          className="text-2xl font-semibold"
        />
      </div>

      <div className="grid gap-3">
        <ReviewPartyRow
          caption={t`Settled in`}
          party={originParty}
          from={from}
          to={to}
          detail={
            <Trans>
              {fromName} stops owing {toName}
            </Trans>
          }
        />

        {destinationParty ? (
          <ReviewPartyRow
            caption={t`Moved to`}
            party={destinationParty}
            from={destinationDebtor}
            to={destinationCreditor}
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
  from,
  to,
  detail,
}: {
  caption: string;
  party: Party;
  from: PartyParticipant | null;
  to: PartyParticipant | null;
  detail: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <PartySymbolBadge
        party={party}
        className="mt-0.5 h-10 w-10 flex-shrink-0 text-base"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-500 dark:text-accent-400">
            {caption}
          </div>
          <div className="h-px min-w-4 flex-1 bg-accent-200/80 dark:bg-accent-800" />
        </div>
        <div className="mt-1 truncate text-base font-semibold text-accent-950 dark:text-accent-50">
          {party.name}
        </div>

        <div className="mt-3 flex items-center gap-2">
          {from ? (
            <TransferParticipantAvatar
              participant={from}
              className="h-8 w-8 flex-shrink-0 text-xs"
            />
          ) : null}
          <Icon
            icon="lucide.arrow-right"
            width={14}
            height={14}
            className="flex-shrink-0 text-accent-500 dark:text-accent-400"
          />
          {to ? (
            <TransferParticipantAvatar
              participant={to}
              className="h-8 w-8 flex-shrink-0 text-xs"
            />
          ) : null}
          <div className="min-w-0 flex-1 text-sm text-accent-700 dark:text-accent-300">
            {detail}
          </div>
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
