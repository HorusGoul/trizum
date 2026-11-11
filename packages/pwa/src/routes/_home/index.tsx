import { view } from "@nkzw/fate";
import type { ProfileEntity } from "#src/lib/data/entities.ts";
import { isValidRecordId } from "#src/lib/data/ids.ts";
import { createFileRoute, redirect } from "@tanstack/react-router";

const LaunchView = view<ProfileEntity>()({
  available: true,
  parties: true,
  archivedParties: true,
  openLastPartyOnLaunch: true,
  lastOpenedPartyId: true,
});

let hasRedirectedThisSession = false;

export const Route = createFileRoute("/_home/")({
  beforeLoad: async ({ context, search }) => {
    // Only redirect once per session (on app launch)
    if (hasRedirectedThisSession) {
      return;
    }

    // An explicit Premium return takes priority over the launch shortcut.
    if (search.premium) {
      hasRedirectedThisSession = true;

      return;
    }

    const partyListId = localStorage.getItem("partyListId");

    if (!partyListId || !isValidRecordId(partyListId)) {
      return;
    }

    const { data: partyList } = await context.client.readView(
      LaunchView,
      context.client.ref<ProfileEntity>("Profile", partyListId, LaunchView),
    );

    if (!partyList.available) {
      return;
    }

    const { openLastPartyOnLaunch, lastOpenedPartyId, parties } = partyList;

    if (
      openLastPartyOnLaunch &&
      lastOpenedPartyId &&
      isValidRecordId(lastOpenedPartyId) &&
      parties[lastOpenedPartyId] &&
      partyList.archivedParties?.[lastOpenedPartyId] !== true
    ) {
      hasRedirectedThisSession = true;
      throw redirect({
        to: "/party/$partyId",
        params: { partyId: lastOpenedPartyId },
        search: { tab: "expenses" },
        replace: true,
      });
    }
  },
});
