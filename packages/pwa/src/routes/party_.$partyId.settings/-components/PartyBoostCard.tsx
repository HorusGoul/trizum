import { Trans, useLingui } from "@lingui/react/macro";
import type { PartyBoostSnapshot } from "#src/models/party.ts";
import type { PartyBoostViewStatus } from "#src/lib/premium/partyBoostViewStatus.ts";
import type { PartyBoostActionState } from "#src/lib/premium/partyBoostActionState.ts";
import type { PartyBoostApiError } from "#src/lib/trizumApiClient.ts";
import { usePartyBoost } from "./usePartyBoost.ts";
import { Button } from "@trizum/ui/Button";
import { Icon } from "@trizum/ui/Icon";
import {
  ModalSheet,
  ModalSheetAction,
  ModalSheetActions,
  ModalSheetContent,
  ModalSheetDescription,
  ModalSheetHeader,
  ModalSheetSection,
  ModalSheetTitle,
} from "@trizum/ui/ModalSheet";

const transferDateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export function PartyBoostCard({
  partyDocumentId,
  boost,
}: {
  partyDocumentId: string;
  boost?: PartyBoostSnapshot;
}) {
  const {
    viewState,
    status,
    actionState,
    canTransfer,
    assignment,
    userId,
    isActivating,
    isTransferConfirmationOpen,
    setIsTransferConfirmationOpen,
    activate,
    openPremium,
    refreshStatus,
  } = usePartyBoost({ partyDocumentId, boost });

  return (
    <>
      <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/45">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-100">
            <Icon icon="lucide.sparkles" width={21} height={21} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">
                <Trans>Party Boost</Trans>
              </h3>
              {status?.party.isBoosted ? (
                <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-semibold text-neutral-800 dark:bg-neutral-700 dark:text-neutral-50">
                  <Trans>Active</Trans>
                </span>
              ) : null}
            </div>
            <PartyBoostDescription
              canTransfer={canTransfer}
              error={viewState.error}
              isRefreshing={viewState.isRefreshing}
              partyDocumentId={partyDocumentId}
              status={status}
              userId={userId}
            />
            <PartyBoostCheckedAt boost={boost} />
          </div>
        </div>

        <PartyBoostAction
          onActivate={activate}
          onOpenPremium={openPremium}
          onOpenTransferConfirmation={() => setIsTransferConfirmationOpen(true)}
          onRetry={refreshStatus}
          state={actionState}
        />
      </div>

      <PartyBoostTransferConfirmation
        isOpen={isTransferConfirmationOpen}
        onOpenChange={setIsTransferConfirmationOpen}
        hasActiveAssignment={Boolean(assignment?.active)}
        isActivating={isActivating}
        onActivate={activate}
      />
    </>
  );
}

function PartyBoostCheckedAt({ boost }: { boost?: PartyBoostSnapshot }) {
  const { i18n } = useLingui();
  // Use the oldest verification when several boosts contribute to this party.
  const dates: number[] = [];

  for (const entry of Object.values(boost ?? {})) {
    const timestamp = Date.parse(entry?.checkedAt);

    if (Number.isFinite(timestamp)) dates.push(timestamp);
  }

  if (!dates.length) return null;
  const date = new Date(Math.min(...dates));
  const checkedAt = i18n.date(date, { dateStyle: "medium", timeStyle: "short" });

  return (
    <p className="text-xs text-neutral-600 dark:text-neutral-300">
      <time dateTime={date.toISOString()}>
        <Trans>Last checked {checkedAt}</Trans>
      </time>
    </p>
  );
}

function PartyBoostTransferConfirmation({
  isOpen,
  onOpenChange,
  hasActiveAssignment,
  isActivating,
  onActivate,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  hasActiveAssignment: boolean;
  isActivating: boolean;
  onActivate: () => Promise<void>;
}) {
  const { t } = useLingui();

  return (
    <ModalSheet aria-label={t`Move Party Boost here?`} isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalSheetHeader>
        <ModalSheetSection>
          <ModalSheetTitle>
            <Trans>Move Party Boost here?</Trans>
          </ModalSheetTitle>
        </ModalSheetSection>
      </ModalSheetHeader>
      <ModalSheetContent>
        <ModalSheetSection>
          <ModalSheetDescription>
            {hasActiveAssignment ? (
              <Trans>
                The previous party will lose its boost. You will not be able to move Party Boost
                again for seven days.
              </Trans>
            ) : (
              <Trans>
                This party will receive your Party Boost. You will not be able to move it again for
                seven days.
              </Trans>
            )}
          </ModalSheetDescription>
        </ModalSheetSection>
        <ModalSheetActions className="mt-3">
          <ModalSheetAction
            icon="lucide.sparkles"
            isDisabled={isActivating}
            onPress={() => void onActivate()}
          >
            <Trans>Move Party Boost</Trans>
          </ModalSheetAction>
          <ModalSheetAction icon="lucide.x" onPress={() => onOpenChange(false)}>
            <Trans>Cancel</Trans>
          </ModalSheetAction>
        </ModalSheetActions>
      </ModalSheetContent>
    </ModalSheet>
  );
}

function PartyBoostDescription({
  canTransfer,
  error,
  isRefreshing,
  partyDocumentId,
  status,
  userId,
}: {
  canTransfer: boolean;
  error: PartyBoostApiError | null;
  isRefreshing: boolean;
  partyDocumentId: string;
  status: PartyBoostViewStatus | null;
  userId: string | null;
}) {
  const assignment = status?.currentUser?.assignment ?? null;

  if (!status && isRefreshing && userId) {
    return (
      <p className="text-sm leading-snug text-neutral-700 dark:text-neutral-200">
        <Trans>Checking Party Boost…</Trans>
      </p>
    );
  }

  if (error?.code === "premium_required" && !status?.party.isBoosted) {
    return (
      <p className="text-sm leading-snug text-neutral-700 dark:text-neutral-200">
        <Trans>Premium is required for Party Boost.</Trans>
      </p>
    );
  }

  if (!status && error) {
    return (
      <p className="text-sm leading-snug text-neutral-700 dark:text-neutral-200">
        <Trans>Party Boost could not be checked. Try again when you are online.</Trans>
      </p>
    );
  }

  if (status?.party.isBoostedByCurrentUser) {
    return (
      <p className="text-sm leading-snug text-neutral-700 dark:text-neutral-200">
        <Trans>Your Premium is boosting this party for everyone in it.</Trans>
      </p>
    );
  }

  if (status?.party.isBoosted) {
    return (
      <p className="text-sm leading-snug text-neutral-700 dark:text-neutral-200">
        <Trans>A Premium member is boosting this party.</Trans>
      </p>
    );
  }

  if (!userId) {
    return (
      <p className="text-sm leading-snug text-neutral-700 dark:text-neutral-200">
        <Trans>Sign in to activate Premium benefits for this party.</Trans>
      </p>
    );
  }

  if (assignment && assignment.partyDocumentId !== partyDocumentId) {
    const transferableDate = formatTransferDate(assignment.transferableAt);

    return (
      <p className="text-sm leading-snug text-neutral-700 dark:text-neutral-200">
        {canTransfer ? (
          <Trans>Your Party Boost is active elsewhere and can be moved here.</Trans>
        ) : (
          <Trans>Your Party Boost can be moved again on {transferableDate}.</Trans>
        )}
      </p>
    );
  }

  return (
    <p className="text-sm leading-snug text-neutral-700 dark:text-neutral-200">
      <Trans>Premium owners can boost one party at a time and move it every seven days.</Trans>
    </p>
  );
}

function PartyBoostAction({
  onActivate,
  onOpenPremium,
  onOpenTransferConfirmation,
  onRetry,
  state,
}: {
  onActivate: () => Promise<void>;
  onOpenPremium: () => Promise<void>;
  onOpenTransferConfirmation: () => void;
  onRetry: () => Promise<void>;
  state: PartyBoostActionState;
}) {
  if (state.type === "signed_out") {
    return (
      <Button color="input-like" onPress={() => void onOpenPremium()}>
        <Trans>Sign in</Trans>
      </Button>
    );
  }

  if (state.type === "retry") {
    return (
      <Button color="input-like" isDisabled={state.disabled} pressAction={onRetry}>
        <Trans>Try again</Trans>
      </Button>
    );
  }

  if (state.type === "active") {
    return (
      <Button color="input-like" isDisabled>
        <Icon icon="lucide.check" width={17} height={17} className="mr-2" />
        <Trans>Party Boost active</Trans>
      </Button>
    );
  }

  if (state.type === "boosted_by_other") {
    return null;
  }

  if (state.type === "upgrade") {
    return (
      <Button color="accent" onPress={() => void onOpenPremium()}>
        <Trans>View Premium options</Trans>
      </Button>
    );
  }

  if (state.type === "locked") {
    return (
      <Button color="input-like" isDisabled>
        <Trans>Party Boost unavailable</Trans>
      </Button>
    );
  }

  if (state.type === "transfer") {
    return (
      <Button color="accent" isDisabled={state.disabled} onPress={onOpenTransferConfirmation}>
        <Trans>Move Party Boost here</Trans>
      </Button>
    );
  }

  return (
    <Button color="accent" isDisabled={state.disabled} pressAction={onActivate}>
      <Trans>Boost this party</Trans>
    </Button>
  );
}

function formatTransferDate(value: number) {
  return transferDateFormatter.format(value);
}
