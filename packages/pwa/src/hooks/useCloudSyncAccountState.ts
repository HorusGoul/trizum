import { t } from "@lingui/core/macro";
import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import { useEffect, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { fetchLinkedAuthAccounts, type LinkedAuthAccount } from "#src/lib/auth-client.ts";
import {
  fetchCloudUserSettings,
  getCloudUserSettingsInput,
  saveCloudUserSettings,
  writeCachedCloudUserSettings,
  type CloudUserSettings,
} from "#src/lib/cloudSyncSettings.ts";
import {
  hasLocalPartyListData,
  readCachedCloudAccountState,
  writeCachedCloudAccountState,
} from "#src/lib/cloudSyncRouteState.ts";
import type { PartyList } from "#src/models/partyList.js";

const CLOUD_ACCOUNT_STATE_POLL_INTERVAL_MS = 30_000;

export function useCloudSyncAccountState({
  isSignInSuccessVisibleRef,
  onCloudDataActivated,
  partyList,
  userId,
}: {
  isSignInSuccessVisibleRef: RefObject<boolean>;
  onCloudDataActivated: (shouldDelay: boolean) => void;
  partyList: PartyList;
  userId: string | undefined;
}) {
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAuthAccount[]>([]);
  const [cloudSettings, setCloudSettings] = useState<CloudUserSettings | null>(null);
  const [isCloudSyncSwitchOpen, setIsCloudSyncSwitchOpen] = useState(false);
  const partyListRef = useRef(partyList);
  const onCloudDataActivatedRef = useRef(onCloudDataActivated);
  const linkedProviderIds = new Set(linkedAccounts.map((account) => account.providerId));
  const hasPasswordAccount = linkedProviderIds.has("credential");

  useEffect(() => {
    partyListRef.current = partyList;
  }, [partyList]);

  useEffect(() => {
    onCloudDataActivatedRef.current = onCloudDataActivated;
  }, [onCloudDataActivated]);

  // oxlint-disable-next-line react-doctor/no-cascading-set-state -- FIXME: address existing React Doctor diagnostics.
  useEffect(() => {
    if (!userId) {
      // oxlint-disable-next-line react-doctor/no-adjust-state-on-prop-change -- FIXME: address existing React Doctor diagnostics.
      setLinkedAccounts([]);
      // oxlint-disable-next-line react-doctor/no-adjust-state-on-prop-change -- FIXME: address existing React Doctor diagnostics.
      setCloudSettings(null);
      // oxlint-disable-next-line react-doctor/no-adjust-state-on-prop-change -- FIXME: address existing React Doctor diagnostics.
      setIsCloudSyncSwitchOpen(false);
      return;
    }

    let isCancelled = false;
    const currentUserId = userId;
    const cachedAccountState = readCachedCloudAccountState(currentUserId);

    if (cachedAccountState) {
      setLinkedAccounts(cachedAccountState.linkedAccounts);
      setCloudSettings(cachedAccountState.cloudSettings);
    } else {
      // oxlint-disable-next-line react-doctor/no-adjust-state-on-prop-change -- FIXME: address existing React Doctor diagnostics.
      setLinkedAccounts([]);
      // oxlint-disable-next-line react-doctor/no-adjust-state-on-prop-change -- FIXME: address existing React Doctor diagnostics.
      setCloudSettings(null);
    }

    void loadAccountState({
      showErrorToast: !cachedAccountState,
      showStartToast: true,
    });

    const intervalId = window.setInterval(() => {
      void loadAccountState({ showErrorToast: false, showStartToast: false });
    }, CLOUD_ACCOUNT_STATE_POLL_INTERVAL_MS);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };

    async function loadAccountState({
      showErrorToast,
      showStartToast,
    }: {
      showErrorToast: boolean;
      showStartToast: boolean;
    }) {
      try {
        const currentPartyList = partyListRef.current;
        const [accounts, { settings }] = await Promise.all([
          fetchLinkedAuthAccounts(),
          fetchCloudUserSettings(),
        ]);

        if (isCancelled) {
          return;
        }

        let activeSettings = settings;

        if (!activeSettings) {
          const { settings: savedSettings } = await saveCloudUserSettings(
            getCloudUserSettingsInput(currentPartyList),
          );

          if (isCancelled) {
            return;
          }

          activeSettings = savedSettings;
          if (showStartToast) {
            toast.success(t`trizum cloud started`);
          }
        }

        setLinkedAccounts(accounts);
        setCloudSettings(activeSettings);
        writeCachedCloudUserSettings(currentUserId, activeSettings);
        writeCachedCloudAccountState(currentUserId, {
          cloudSettings: activeSettings,
          linkedAccounts: accounts,
        });

        if (!activeSettings) {
          return;
        }

        if (!isValidDocumentId(activeSettings.partyListDocumentId)) {
          toast.error(t`trizum cloud data is invalid`);
          return;
        }

        if (activeSettings.partyListDocumentId === currentPartyList.id) {
          return;
        }

        if (hasLocalPartyListData(currentPartyList)) {
          setIsCloudSyncSwitchOpen(true);
          return;
        }

        localStorage.setItem("partyListId", activeSettings.partyListDocumentId);
        setCloudSettings(activeSettings);
        setIsCloudSyncSwitchOpen(false);
        writeCachedCloudUserSettings(currentUserId, activeSettings);
        writeCachedCloudAccountState(currentUserId, {
          cloudSettings: activeSettings,
          linkedAccounts: accounts,
        });
        toast.success(t`trizum cloud enabled on this device`);
        onCloudDataActivatedRef.current(isSignInSuccessVisibleRef.current);
      } catch {
        if (!isCancelled && showErrorToast) {
          toast.error(t`Could not load trizum cloud state`);
        }
      }
    }
  }, [isSignInSuccessVisibleRef, userId]);

  function saveLinkedAccounts(accounts: LinkedAuthAccount[]) {
    setLinkedAccounts(accounts);

    if (userId) {
      writeCachedCloudAccountState(userId, {
        cloudSettings,
        linkedAccounts: accounts,
      });
    }
  }

  function clearCloudSyncState() {
    setCloudSettings(null);
    setLinkedAccounts([]);
    setIsCloudSyncSwitchOpen(false);
  }

  function activateCloudSyncOnDevice(settings: CloudUserSettings | null = cloudSettings) {
    if (!settings) {
      toast.message(t`trizum cloud is not set up yet`);
      return;
    }

    if (!isValidDocumentId(settings.partyListDocumentId)) {
      toast.error(t`trizum cloud data is invalid`);
      return;
    }

    if (settings.partyListDocumentId === partyList.id) {
      toast.message(t`This device is already using trizum cloud`);
      return;
    }

    localStorage.setItem("partyListId", settings.partyListDocumentId);

    if (userId) {
      setCloudSettings(settings);
      setIsCloudSyncSwitchOpen(false);
      writeCachedCloudUserSettings(userId, settings);
      writeCachedCloudAccountState(userId, {
        cloudSettings: settings,
        linkedAccounts,
      });
    } else {
      setCloudSettings(settings);
      setIsCloudSyncSwitchOpen(false);
    }

    toast.success(t`trizum cloud enabled on this device`);
    onCloudDataActivatedRef.current(isSignInSuccessVisibleRef.current);
  }

  return {
    activateCloudSyncOnDevice,
    clearCloudSyncState,
    hasPasswordAccount,
    isCloudSyncSwitchOpen,
    linkedProviderIds,
    saveLinkedAccounts,
    setIsCloudSyncSwitchOpen,
  };
}
