import { t } from "@lingui/core/macro";
import { useSuspenseDocument, isValidDocumentId } from "@trizum/sdk";
import type { Party } from "#src/models/party.ts";
import { defaultThemeHue, setThemeHue } from "#src/ui/theme.ts";
import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";

export function PartyTheme() {
  const partyId = useLocation({
    select: (location) => {
      if (location.pathname.startsWith("/party/")) {
        return location.pathname.split("/")[2];
      }
      return undefined;
    },
  });

  return partyId ? <SetPartyTheme partyId={partyId} /> : <ClearTheme />;
}

function SetPartyTheme({ partyId }: { partyId: string }) {
  if (!isValidDocumentId(partyId)) throw new Error(t`Malformed Party ID`);
  const [party] = useSuspenseDocument<Party>(partyId, {
    required: false,
  });

  const hue = party?.hue ?? defaultThemeHue;

  useEffect(() => {
    setThemeHue(hue);
  }, [hue]);

  return null;
}

function ClearTheme() {
  useEffect(() => {
    setThemeHue(defaultThemeHue);
  }, []);

  return null;
}
