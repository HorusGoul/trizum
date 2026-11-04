import type {} from "../../src/lib/testing/browserHarnessApi.ts";
import type { Repo } from "@automerge/automerge-repo/slim";
import type { Party } from "../../src/models/party";

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
