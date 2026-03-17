import type { DocumentId, Repo } from "@automerge/automerge-repo/slim";
import type { SupportedLocale } from "#src/lib/i18n.js";
import { getPartyListHandle, type PartyList } from "#src/models/partyList.js";

export interface InternalPartyListSeed {
  username?: string;
  phone?: string;
  avatarId?: DocumentId | null;
  locale?: SupportedLocale;
  openLastPartyOnLaunch?: boolean;
  autoOpenCalculator?: boolean;
  hue?: number;
  lastOpenedPartyId?: DocumentId | null;
  parties?: PartyList["parties"];
  participantInParties?: PartyList["participantInParties"];
}

export interface InternalPartyListSeedResult {
  partyListId: DocumentId;
}

export async function seedPartyListState({
  repo,
  seed,
}: {
  repo: Repo;
  seed: InternalPartyListSeed;
}): Promise<InternalPartyListSeedResult> {
  const partyListHandle = await getPartyListHandle(repo);
  const partyListId = partyListHandle.documentId;

  partyListHandle.change((partyList) => {
    partyList.username = seed.username ?? "";
    partyList.phone = seed.phone ?? "";
    partyList.parties = seed.parties ?? {};
    partyList.participantInParties = seed.participantInParties ?? {};

    if (seed.avatarId === undefined) {
      delete partyList["avatarId"];
    } else {
      partyList.avatarId = seed.avatarId;
    }

    if (seed.locale === undefined) {
      delete partyList["locale"];
    } else {
      partyList.locale = seed.locale;
    }

    if (seed.openLastPartyOnLaunch === undefined) {
      delete partyList["openLastPartyOnLaunch"];
    } else {
      partyList.openLastPartyOnLaunch = seed.openLastPartyOnLaunch;
    }

    if (seed.autoOpenCalculator === undefined) {
      delete partyList["autoOpenCalculator"];
    } else {
      partyList.autoOpenCalculator = seed.autoOpenCalculator;
    }

    if (seed.hue === undefined) {
      delete partyList["hue"];
    } else {
      partyList.hue = seed.hue;
    }

    if (seed.lastOpenedPartyId === undefined) {
      delete partyList["lastOpenedPartyId"];
    } else {
      partyList.lastOpenedPartyId = seed.lastOpenedPartyId;
    }
  });

  return {
    partyListId,
  };
}
