import type { Repo } from "@automerge/automerge-repo/slim";
import type { Party } from "../../src/models/party";

declare global {
  interface Window {
    __internal_setPartyBoost?: (partyId: Party["id"], boost: Party["boost"]) => Promise<void>;
  }
}

/** Test fixture only: normal builds omit this module and its global setter. */
export function installPartyBoostBrowserSeed(repo: Repo) {
  window.__internal_setPartyBoost = async (partyId, boost) => {
    const handle = await repo.find<Party>(partyId);
    handle.change((party) => {
      if (boost === undefined) delete party.boost;
      else party.boost = boost;
    });
    await repo.flush();
  };
}
