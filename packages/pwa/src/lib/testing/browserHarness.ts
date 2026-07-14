import type { DocumentId, Repo } from "@automerge/automerge-repo/slim";
import type { SupportedLocale } from "#src/lib/locales.js";
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
  pinnedParties?: NonNullable<PartyList["pinnedParties"]>;
  archivedParties?: NonNullable<PartyList["archivedParties"]>;
  lastUsedAt?: NonNullable<PartyList["lastUsedAt"]>;
  participantInParties?: PartyList["participantInParties"];
}

export interface InternalPartyListSeedResult {
  partyListId: DocumentId;
}

export interface InternalPartyListSnapshot {
  partyListId: DocumentId;
  lastOpenedPartyId: DocumentId | null;
  parties: PartyList["parties"];
  pinnedParties: NonNullable<PartyList["pinnedParties"]>;
  archivedParties: NonNullable<PartyList["archivedParties"]>;
  lastUsedAt: NonNullable<PartyList["lastUsedAt"]>;
  participantInParties: PartyList["participantInParties"];
}

function applyPartyListSeed(partyList: PartyList, seed: InternalPartyListSeed) {
  partyList.username = seed.username ?? "";
  partyList.phone = seed.phone ?? "";
  partyList.parties = seed.parties ?? {};
  partyList.pinnedParties = seed.pinnedParties ?? {};
  partyList.archivedParties = seed.archivedParties ?? {};
  partyList.lastUsedAt = seed.lastUsedAt ?? {};
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
}

export function createInactivePartyListState({
  repo,
  seed,
}: {
  repo: Repo;
  seed: InternalPartyListSeed;
}): InternalPartyListSeedResult {
  const partyListHandle = repo.create<PartyList>({
    id: "" as DocumentId,
    type: "partyList",
    username: "",
    phone: "",
    parties: {},
    pinnedParties: {},
    archivedParties: {},
    lastUsedAt: {},
    participantInParties: {},
  });

  partyListHandle.change((partyList) => {
    partyList.id = partyListHandle.documentId;
    applyPartyListSeed(partyList, seed);
  });

  return {
    partyListId: partyListHandle.documentId,
  };
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
    applyPartyListSeed(partyList, seed);
  });

  await repo.flush([partyListId]);

  return {
    partyListId,
  };
}

export async function readPartyListState({
  repo,
}: {
  repo: Repo;
}): Promise<InternalPartyListSnapshot> {
  const partyListHandle = await getPartyListHandle(repo);
  const partyList = partyListHandle.doc();

  return {
    partyListId: partyListHandle.documentId,
    lastOpenedPartyId: partyList?.lastOpenedPartyId ?? null,
    parties: { ...(partyList?.parties ?? {}) },
    pinnedParties: { ...(partyList?.pinnedParties ?? {}) },
    archivedParties: { ...(partyList?.archivedParties ?? {}) },
    lastUsedAt: { ...(partyList?.lastUsedAt ?? {}) },
    participantInParties: {
      ...(partyList?.participantInParties ?? {}),
    },
  };
}
