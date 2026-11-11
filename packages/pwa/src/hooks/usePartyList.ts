import { useEffect, useSyncExternalStore } from "react";
import { type PartyList } from "#src/models/partyList.ts";
import { useDataRecord } from "#src/lib/data/hooks.ts";
import { useAppData } from "#src/lib/data/useAppData.ts";
import { getBrowserLocale, setLocale } from "#src/lib/i18n.ts";
import { setThemeHue, defaultThemeHue } from "@trizum/ui/theme";

export function usePartyList() {
  const data = useAppData();

  const partyListId = useSyncExternalStore(
    data.subscribeToProfile,
    data.activeProfileId,
    data.activeProfileId,
  );

  const [partyList] = useDataRecord<PartyList>(partyListId, {
    required: true,
  });

  useEffect(() => {
    setLocale(partyList.locale ?? getBrowserLocale());
  }, [partyList.locale]);

  useEffect(() => {
    setThemeHue(partyList.hue ?? defaultThemeHue);
  }, [partyList.hue]);

  return { partyList, ...data.profileActions(partyList.id) };
}
