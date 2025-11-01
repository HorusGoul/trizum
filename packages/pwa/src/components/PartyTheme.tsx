import { useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.ts";
import type { Party } from "#src/models/party.ts";
import { defaultThemeHue, setThemeHue } from "#src/ui/theme.ts";
import {
  isValidDocumentId,
  type AnyDocumentId,
} from "@automerge/automerge-repo";
import { useLocation, useMatch, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { t } from "@lingui/macro";

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
  const [party] = useSuspenseDocument<Party>(partyId as AnyDocumentId, {
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
