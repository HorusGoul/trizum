import type { PartyList } from "#src/models/partyList.js";
import { documentCache } from "#src/lib/automerge/suspense-hooks.js";
import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import { createFileRoute, redirect } from "@tanstack/react-router";

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
    if (!partyListId || !isValidDocumentId(partyListId)) {
      return;
    }

    const partyList = (await documentCache.readAsync(context.repo, partyListId)) as
      | PartyList
      | undefined;

    if (!partyList) {
      return;
    }

    const { openLastPartyOnLaunch, lastOpenedPartyId, parties } = partyList;

    if (
      openLastPartyOnLaunch &&
      lastOpenedPartyId &&
      isValidDocumentId(lastOpenedPartyId) &&
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
