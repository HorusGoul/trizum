import { useEffect } from "react";
import { usePartyList as useSdkPartyList, type PartyList } from "@trizum/sdk";
import { getBrowserLocale, setLocale } from "#src/lib/i18n.js";

/**
 * PWA hook for party list management.
 *
 * Wraps the SDK's usePartyList hook and adds locale syncing.
 */
export function usePartyList() {
  const sdkResult = useSdkPartyList();

  // Sync locale to i18n when partyList.locale changes
  useEffect(() => {
    setLocale(sdkResult.partyList.locale ?? getBrowserLocale());
  }, [sdkResult.partyList.locale]);

  // Wrap updateSettings to accept the PWA's expected type
  function updateSettings(
    values: Pick<
      PartyList,
      "username" | "phone" | "avatarId" | "locale" | "openLastPartyOnLaunch"
    >,
  ) {
    return sdkResult.updateSettings(values);
  }

  return {
    partyList: sdkResult.partyList,
    addPartyToList: sdkResult.addPartyToList,
    removeParty: sdkResult.removeParty,
    updateSettings,
    setLastOpenedPartyId: sdkResult.setLastOpenedPartyId,
  };
}
