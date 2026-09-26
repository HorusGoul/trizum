import { Capacitor } from "@capacitor/core";
import { Trans, useLingui } from "@lingui/react/macro";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAppSession } from "#src/lib/auth-client.ts";
import type { PartyBoostStatus } from "#src/lib/api/premiumContract.ts";
import {
  getPartyBoostActionState,
  type PartyBoostActionState,
} from "#src/lib/premium/partyBoostActionState.ts";
import {
  PartyBoostRequestGate,
  shouldInvalidatePartyBoostCache,
} from "#src/lib/premium/partyBoostRequestState.ts";
import { usePremium } from "#src/lib/premium/PremiumContext.ts";
import {
  isPartyBoostStatus,
  PartyBoostApiError,
  trizumApiClient,
} from "#src/lib/trizumApiClient.ts";
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.tsx";
import {
  ModalSheet,
  ModalSheetAction,
  ModalSheetActions,
  ModalSheetContent,
  ModalSheetDescription,
  ModalSheetHeader,
  ModalSheetSection,
  ModalSheetTitle,
} from "#src/ui/ModalSheet.tsx";

interface PartyBoostViewState {
  error: PartyBoostApiError | null;
  isRefreshing: boolean;
  status: PartyBoostStatus | null;
}

const transferDateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export function PartyBoostCard({ partyDocumentId }: { partyDocumentId: string }) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const session = useAppSession();
  const userId = session.data?.user.id ?? null;
  const requestContext = JSON.stringify([userId, partyDocumentId]);
  const { isPremium: isDevicePremium, presentPaywall } = usePremium();
  const [statusRequests] = useState(() => new PartyBoostRequestGate());
  const [activatingContext, setActivatingContext] = useState<string | null>(null);
  const [isTransferConfirmationOpen, setIsTransferConfirmationOpen] = useState(false);
  const [now, setNow] = useState(0);
  const [viewState, setViewState] = useState<PartyBoostViewState>({
    error: null,
    isRefreshing: false,
    status: null,
  });

  useEffect(() => {
    statusRequests.enterContext(requestContext);
    if (!userId) {
      return;
    }

    let active = true;
    const activeUserId = userId;
    const cachedStatus = readCachedPartyBoostStatus(activeUserId, partyDocumentId);
    queueMicrotask(() => {
      if (active) {
        setViewState({ error: null, isRefreshing: true, status: cachedStatus });
      }
    });

    async function refresh() {
      const request = statusRequests.beginRead(requestContext);
      try {
        const status = await trizumApiClient.premium.getPartyBoostStatus(partyDocumentId);
        if (!active || !statusRequests.isCurrent(request)) {
          return;
        }

        writeCachedPartyBoostStatus(activeUserId, partyDocumentId, status);
        setViewState({ error: null, isRefreshing: false, status });
      } catch (error) {
        if (!active || !statusRequests.isCurrent(request)) {
          return;
        }

        const partyBoostError = toPartyBoostApiError(error);
        const invalidateCache = shouldInvalidatePartyBoostCache(partyBoostError.code);
        if (invalidateCache) {
          clearCachedPartyBoostStatus(activeUserId, partyDocumentId);
        }
        setViewState((current) => ({
          error: partyBoostError,
          isRefreshing: false,
          status: invalidateCache ? null : current.status,
        }));
      }
    }

    function handleOnline() {
      setViewState((current) => ({ ...current, isRefreshing: true }));
      void refresh();
    }

    void refresh();
    window.addEventListener("online", handleOnline);

    return () => {
      active = false;
      statusRequests.invalidateReads(requestContext);
      window.removeEventListener("online", handleOnline);
    };
  }, [partyDocumentId, requestContext, statusRequests, userId]);

  useEffect(() => {
    const transferableAt = viewState.status?.currentUser.assignment?.transferableAt;
    if (!transferableAt) {
      return;
    }

    const timeoutId = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(Math.max(transferableAt - Date.now() + 1, 0), 2_147_483_647),
    );
    return () => window.clearTimeout(timeoutId);
  }, [viewState.status?.currentUser.assignment?.transferableAt]);

  async function refreshStatus() {
    if (!userId) {
      return;
    }

    setViewState((current) => ({ ...current, error: null, isRefreshing: true }));
    const request = statusRequests.beginRead(requestContext);
    try {
      const status = await trizumApiClient.premium.getPartyBoostStatus(partyDocumentId);
      if (!statusRequests.isCurrent(request)) {
        return;
      }
      writeCachedPartyBoostStatus(userId, partyDocumentId, status);
      setViewState({ error: null, isRefreshing: false, status });
    } catch (error) {
      if (!statusRequests.isCurrent(request)) {
        return;
      }

      const partyBoostError = toPartyBoostApiError(error);
      const invalidateCache = shouldInvalidatePartyBoostCache(partyBoostError.code);
      if (invalidateCache) {
        clearCachedPartyBoostStatus(userId, partyDocumentId);
      }
      setViewState((current) => ({
        error: partyBoostError,
        isRefreshing: false,
        status: invalidateCache ? null : current.status,
      }));
    }
  }

  async function activate() {
    const isActivating = activatingContext === requestContext;
    if (isActivating) {
      return;
    }

    if (!userId) {
      await navigate({ to: "/settings/cloud-sync" });
      return;
    }

    const mutationContext = requestContext;
    setActivatingContext(mutationContext);
    statusRequests.beginMutation(mutationContext);
    try {
      const status = await trizumApiClient.premium.activatePartyBoost(partyDocumentId);
      if (!statusRequests.finishMutation(mutationContext)) {
        setActivatingContext((current) => (current === mutationContext ? null : current));
        return;
      }
      writeCachedPartyBoostStatus(userId, partyDocumentId, status);
      setViewState({ error: null, isRefreshing: false, status });
      setIsTransferConfirmationOpen(false);
      toast.success(t`Party Boost is active.`);
    } catch (error) {
      if (!statusRequests.finishMutation(mutationContext)) {
        setActivatingContext((current) => (current === mutationContext ? null : current));
        return;
      }
      const partyBoostError = toPartyBoostApiError(error);
      clearCachedPartyBoostStatus(userId, partyDocumentId);
      setIsTransferConfirmationOpen(false);
      setViewState({ error: partyBoostError, isRefreshing: false, status: null });
      switch (partyBoostError.code) {
        case "already_boosted":
          toast.error(t`This party already has an active Party Boost.`);
          break;
        case "membership_required":
          toast.error(t`You must be a member of this party to boost it.`);
          break;
        case "premium_required":
          toast.error(t`Premium is required for Party Boost.`);
          break;
        case "transfer_locked":
          toast.error(t`Party Boost can only move once every seven days.`);
          break;
        default:
          toast.error(t`Party Boost is unavailable. Please try again.`);
      }
    }
    setActivatingContext((current) => (current === mutationContext ? null : current));
  }

  async function openPremium() {
    if (!userId) {
      await navigate({ to: "/settings/cloud-sync" });
      return;
    }

    try {
      await presentPaywall();
      await refreshStatus();
    } catch {
      toast.error(t`Could not open Premium. Please try again.`);
    }
  }

  const status = userId ? viewState.status : null;
  const isActivating = activatingContext === requestContext;
  const assignment = status?.currentUser.assignment ?? null;
  const isAssignedElsewhere = Boolean(assignment && assignment.partyDocumentId !== partyDocumentId);
  const canTransfer = Boolean(
    isAssignedElsewhere && assignment && assignment.transferableAt <= now,
  );
  const actionState = getPartyBoostActionState({
    isActivating,
    isDevicePremium,
    isNativePlatform: Capacitor.isNativePlatform(),
    isRefreshing: viewState.isRefreshing,
    isSignedIn: Boolean(userId),
    now,
    partyDocumentId,
    status,
  });

  return (
    <>
      <div className="border-accent-200 bg-accent-50/60 dark:border-accent-800 dark:bg-accent-900/45 flex flex-col gap-4 rounded-2xl border p-4">
        <div className="flex items-start gap-3">
          <span className="bg-accent-100 text-accent-700 dark:bg-accent-800 dark:text-accent-100 flex size-11 shrink-0 items-center justify-center rounded-full">
            <Icon icon="lucide.sparkles" width={21} height={21} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">
                <Trans>Party Boost</Trans>
              </h3>
              {status?.party.isBoosted ? (
                <span className="bg-accent-200 text-accent-800 dark:bg-accent-700 dark:text-accent-50 rounded-full px-2 py-0.5 text-xs font-semibold">
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

      <ModalSheet
        aria-label={t`Move Party Boost here?`}
        isOpen={isTransferConfirmationOpen}
        onOpenChange={setIsTransferConfirmationOpen}
      >
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
              {assignment?.active ? (
                <Trans>
                  The previous party will lose its boost. You will not be able to move Party Boost
                  again for seven days.
                </Trans>
              ) : (
                <Trans>
                  This party will receive your Party Boost. You will not be able to move it again
                  for seven days.
                </Trans>
              )}
            </ModalSheetDescription>
          </ModalSheetSection>
          <ModalSheetActions className="mt-3">
            <ModalSheetAction
              icon="lucide.sparkles"
              isDisabled={isActivating}
              onPress={() => void activate()}
            >
              <Trans>Move Party Boost</Trans>
            </ModalSheetAction>
            <ModalSheetAction icon="lucide.x" onPress={() => setIsTransferConfirmationOpen(false)}>
              <Trans>Cancel</Trans>
            </ModalSheetAction>
          </ModalSheetActions>
        </ModalSheetContent>
      </ModalSheet>
    </>
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
  status: PartyBoostStatus | null;
  userId: string | null;
}) {
  const assignment = status?.currentUser.assignment ?? null;

  if (!userId) {
    return (
      <p className="text-accent-700 dark:text-accent-200 text-sm leading-snug">
        <Trans>Sign in to activate Premium benefits for this party.</Trans>
      </p>
    );
  }

  if (!status && isRefreshing) {
    return (
      <p className="text-accent-700 dark:text-accent-200 text-sm leading-snug">
        <Trans>Checking Party Boost…</Trans>
      </p>
    );
  }

  if (!status && error) {
    return (
      <p className="text-accent-700 dark:text-accent-200 text-sm leading-snug">
        <Trans>Party Boost could not be checked. Try again when you are online.</Trans>
      </p>
    );
  }

  if (status?.party.isBoostedByCurrentUser) {
    return (
      <p className="text-accent-700 dark:text-accent-200 text-sm leading-snug">
        <Trans>Your Premium is boosting this party for everyone in it.</Trans>
      </p>
    );
  }

  if (status?.party.isBoosted) {
    return (
      <p className="text-accent-700 dark:text-accent-200 text-sm leading-snug">
        <Trans>A Premium member is boosting this party.</Trans>
      </p>
    );
  }

  if (assignment && assignment.partyDocumentId !== partyDocumentId) {
    const transferableDate = formatTransferDate(assignment.transferableAt);
    return (
      <p className="text-accent-700 dark:text-accent-200 text-sm leading-snug">
        {canTransfer ? (
          <Trans>Your Party Boost is active elsewhere and can be moved here.</Trans>
        ) : (
          <Trans>Your Party Boost can be moved again on {transferableDate}.</Trans>
        )}
      </p>
    );
  }

  return (
    <p className="text-accent-700 dark:text-accent-200 text-sm leading-snug">
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
      <Button color="accent" pressAction={onOpenPremium}>
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

function getCacheKey(userId: string, partyDocumentId: string) {
  return `trizum:party-boost:v1:${userId}:${partyDocumentId}`;
}

function readCachedPartyBoostStatus(userId: string, partyDocumentId: string) {
  try {
    const value = localStorage.getItem(getCacheKey(userId, partyDocumentId));
    const parsedValue = value ? (JSON.parse(value) as unknown) : null;
    return isPartyBoostStatus(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

function writeCachedPartyBoostStatus(
  userId: string,
  partyDocumentId: string,
  status: PartyBoostStatus,
) {
  try {
    localStorage.setItem(getCacheKey(userId, partyDocumentId), JSON.stringify(status));
  } catch {
    // The authoritative state is still available from the server when storage is unavailable.
  }
}

function clearCachedPartyBoostStatus(userId: string, partyDocumentId: string) {
  try {
    localStorage.removeItem(getCacheKey(userId, partyDocumentId));
  } catch {
    // The stale cache is ignored for the rest of this mounted view.
  }
}

function toPartyBoostApiError(error: unknown) {
  return error instanceof PartyBoostApiError
    ? error
    : new PartyBoostApiError({ code: "unavailable", message: "Party Boost is unavailable." });
}
