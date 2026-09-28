import { Capacitor } from "@capacitor/core";
import { useLingui } from "@lingui/react/macro";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAppSession } from "#src/lib/auth-client.ts";
import type { PartyBoostSnapshot } from "#src/models/party.ts";
import type { PartyBoostStatus } from "#src/lib/api/premiumContract.ts";
import {
  getPartyBoostViewStatus,
  getPartyBoostMembershipKey,
} from "#src/lib/premium/partyBoostViewStatus.ts";
import { getPartyBoostActionState } from "#src/lib/premium/partyBoostActionState.ts";
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

interface PartyBoostViewState {
  context: string;
  error: PartyBoostApiError | null;
  isRefreshing: boolean;
  premiumRequired: boolean;
  status: PartyBoostStatus | null;
}

export function usePartyBoost({
  partyDocumentId,
  boost,
}: {
  partyDocumentId: string;
  boost?: PartyBoostSnapshot;
}) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const session = useAppSession();
  const userId = session.data?.user.id ?? null;
  const requestContext = JSON.stringify([userId, partyDocumentId]);
  const { isPremium: isDevicePremium, presentPaywall } = usePremium();
  const boostMembershipKey = getPartyBoostMembershipKey(boost);
  const [statusRequests] = useState(() => new PartyBoostRequestGate());
  const [activatingContext, setActivatingContext] = useState<string | null>(null);
  const [isTransferConfirmationOpen, setIsTransferConfirmationOpen] = useState(false);
  const [now, setNow] = useState(0);
  const [storedViewState, setViewState] = useState<PartyBoostViewState>({
    context: requestContext,
    error: null,
    isRefreshing: true,
    premiumRequired: false,
    status: null,
  });
  const viewState: PartyBoostViewState =
    storedViewState.context === requestContext
      ? storedViewState
      : {
          context: requestContext,
          error: null,
          isRefreshing: true,
          premiumRequired: false,
          status: null,
        };

  useEffect(() => {
    statusRequests.enterContext(requestContext);
    if (!userId) return;

    let active = true;
    const activeUserId = userId;
    const cachedStatus = readCachedPartyBoostStatus(activeUserId, partyDocumentId);
    queueMicrotask(() => {
      if (active) {
        setViewState((current) => ({
          context: requestContext,
          error: current.context === requestContext ? current.error : null,
          isRefreshing: true,
          premiumRequired: current.context === requestContext && current.premiumRequired,
          status:
            current.context === requestContext ? (current.status ?? cachedStatus) : cachedStatus,
        }));
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
        setViewState((current) => ({
          context: requestContext,
          error: null,
          isRefreshing: false,
          premiumRequired:
            current.context === requestContext &&
            current.premiumRequired &&
            !status.currentUser.isPremium,
          status,
        }));
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
          context: requestContext,
          error: partyBoostError,
          isRefreshing: false,
          premiumRequired:
            current.context === requestContext && current.premiumRequired && !invalidateCache,
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
  }, [
    boostMembershipKey,
    isDevicePremium,
    partyDocumentId,
    requestContext,
    statusRequests,
    userId,
  ]);

  useEffect(() => {
    const transferableAt = viewState.status?.currentUser?.assignment?.transferableAt;
    if (!transferableAt) {
      return;
    }

    const timeoutId = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(Math.max(transferableAt - Date.now() + 1, 0), 2_147_483_647),
    );
    return () => window.clearTimeout(timeoutId);
  }, [viewState.status?.currentUser?.assignment?.transferableAt]);

  async function refreshStatus() {
    if (!userId) return;
    setViewState((current) => ({ ...current, error: null, isRefreshing: true }));
    const request = statusRequests.beginRead(requestContext);
    try {
      const status = await trizumApiClient.premium.getPartyBoostStatus(partyDocumentId);
      if (!statusRequests.isCurrent(request)) {
        return;
      }
      writeCachedPartyBoostStatus(userId, partyDocumentId, status);
      setViewState((current) => ({
        context: requestContext,
        error: null,
        isRefreshing: false,
        premiumRequired:
          current.context === requestContext &&
          current.premiumRequired &&
          !status.currentUser.isPremium,
        status,
      }));
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
        context: requestContext,
        error: partyBoostError,
        isRefreshing: false,
        premiumRequired:
          current.context === requestContext && current.premiumRequired && !invalidateCache,
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
      setViewState({
        context: requestContext,
        error: null,
        isRefreshing: false,
        premiumRequired: false,
        status,
      });
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
      setViewState({
        context: requestContext,
        error: partyBoostError,
        isRefreshing: false,
        premiumRequired: partyBoostError.code === "premium_required",
        status: null,
      });
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
      const entitlement = await presentPaywall();
      if (!statusRequests.isInContext(requestContext)) return;
      if (entitlement?.isPremium) {
        setViewState((current) => ({ ...current, premiumRequired: false }));
      }
      await refreshStatus();
    } catch {
      toast.error(t`Could not open Premium. Please try again.`);
    }
  }

  const status = getPartyBoostViewStatus(userId ? viewState.status : null, boost);
  const isActivating = activatingContext === requestContext;
  const assignment = status?.currentUser?.assignment ?? null;
  const isAssignedElsewhere = Boolean(assignment && assignment.partyDocumentId !== partyDocumentId);
  const canTransfer = Boolean(
    isAssignedElsewhere && assignment && assignment.transferableAt <= now,
  );
  const actionState = getPartyBoostActionState({
    isActivating,
    isDevicePremium,
    isNativePlatform: Capacitor.isNativePlatform(),
    isRefreshing: viewState.isRefreshing,
    premiumRequired: viewState.premiumRequired,
    isSignedIn: Boolean(userId),
    now,
    partyDocumentId,
    status,
  });

  return {
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
  };
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
