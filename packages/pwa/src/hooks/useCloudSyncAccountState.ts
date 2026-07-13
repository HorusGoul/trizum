import { t } from "@lingui/core/macro";
import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import { useEffect, useReducer, useRef, type RefObject } from "react";
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

interface CloudSyncAccountState {
  cloudSettings: CloudUserSettings | null;
  isAccountStateResolved: boolean;
  isCloudSyncSwitchOpen: boolean;
  linkedAccounts: LinkedAuthAccount[];
}

type CloudSyncAccountStateAction =
  | { type: "cleared" }
  | {
      type: "accountChanged";
      cloudSettings: CloudUserSettings | null;
      linkedAccounts: LinkedAuthAccount[];
    }
  | {
      type: "accountDataLoaded";
      cloudSettings: CloudUserSettings | null;
      linkedAccounts: LinkedAuthAccount[];
    }
  | { type: "accountDataResolved" }
  | { type: "cloudSettingsActivated"; cloudSettings: CloudUserSettings }
  | { type: "linkedAccountsSaved"; linkedAccounts: LinkedAuthAccount[] }
  | { type: "switchOpenChanged"; isOpen: boolean };

const initialCloudSyncAccountState: CloudSyncAccountState = {
  cloudSettings: null,
  isAccountStateResolved: false,
  isCloudSyncSwitchOpen: false,
  linkedAccounts: [],
};

function cloudSyncAccountStateReducer(
  state: CloudSyncAccountState,
  action: CloudSyncAccountStateAction,
): CloudSyncAccountState {
  switch (action.type) {
    case "cleared":
      return initialCloudSyncAccountState;

    case "accountChanged":
      return {
        ...state,
        cloudSettings: action.cloudSettings,
        isAccountStateResolved: false,
        isCloudSyncSwitchOpen: false,
        linkedAccounts: action.linkedAccounts,
      };

    case "accountDataLoaded":
      return {
        ...state,
        cloudSettings: action.cloudSettings,
        isAccountStateResolved: true,
        linkedAccounts: action.linkedAccounts,
      };

    case "accountDataResolved":
      return {
        ...state,
        isAccountStateResolved: true,
      };

    case "cloudSettingsActivated":
      return {
        ...state,
        cloudSettings: action.cloudSettings,
        isCloudSyncSwitchOpen: false,
      };

    case "linkedAccountsSaved":
      return {
        ...state,
        linkedAccounts: action.linkedAccounts,
      };

    case "switchOpenChanged":
      return {
        ...state,
        isCloudSyncSwitchOpen: action.isOpen,
      };
  }
}

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
  const [state, dispatch] = useReducer(cloudSyncAccountStateReducer, initialCloudSyncAccountState);
  const { cloudSettings, isAccountStateResolved, isCloudSyncSwitchOpen, linkedAccounts } = state;
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

  useEffect(() => {
    if (!userId) {
      dispatch({ type: "cleared" });
      return;
    }

    let isCancelled = false;
    const currentUserId = userId;
    const cachedAccountState = readCachedCloudAccountState(currentUserId);

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

        dispatch({
          type: "accountDataLoaded",
          cloudSettings: activeSettings,
          linkedAccounts: accounts,
        });
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
          dispatch({ type: "switchOpenChanged", isOpen: true });
          return;
        }

        localStorage.setItem("partyListId", activeSettings.partyListDocumentId);
        dispatch({ type: "cloudSettingsActivated", cloudSettings: activeSettings });
        writeCachedCloudUserSettings(currentUserId, activeSettings);
        writeCachedCloudAccountState(currentUserId, {
          cloudSettings: activeSettings,
          linkedAccounts: accounts,
        });
        toast.success(t`trizum cloud enabled on this device`);
        onCloudDataActivatedRef.current(isSignInSuccessVisibleRef.current);
      } catch {
        if (!isCancelled) {
          dispatch({ type: "accountDataResolved" });
          if (showErrorToast) {
            toast.error(t`Could not load trizum cloud state`);
          }
        }
      }
    }

    dispatch({
      type: "accountChanged",
      linkedAccounts: cachedAccountState?.linkedAccounts ?? [],
      cloudSettings: cachedAccountState?.cloudSettings ?? null,
    });

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
  }, [isSignInSuccessVisibleRef, userId]);

  function saveLinkedAccounts(accounts: LinkedAuthAccount[]) {
    dispatch({ type: "linkedAccountsSaved", linkedAccounts: accounts });

    if (userId) {
      writeCachedCloudAccountState(userId, {
        cloudSettings,
        linkedAccounts: accounts,
      });
    }
  }

  function clearCloudSyncState() {
    dispatch({ type: "cleared" });
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
      dispatch({ type: "cloudSettingsActivated", cloudSettings: settings });
      writeCachedCloudUserSettings(userId, settings);
      writeCachedCloudAccountState(userId, {
        cloudSettings: settings,
        linkedAccounts,
      });
    } else {
      dispatch({ type: "cloudSettingsActivated", cloudSettings: settings });
    }

    toast.success(t`trizum cloud enabled on this device`);
    onCloudDataActivatedRef.current(isSignInSuccessVisibleRef.current);
  }

  return {
    activateCloudSyncOnDevice,
    clearCloudSyncState,
    hasPasswordAccount,
    isAccountStateResolved,
    isCloudSyncSwitchOpen,
    linkedProviderIds,
    saveLinkedAccounts,
    setIsCloudSyncSwitchOpen: (isOpen: boolean) => dispatch({ type: "switchOpenChanged", isOpen }),
  };
}
