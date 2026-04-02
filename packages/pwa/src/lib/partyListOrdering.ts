import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import type { Party } from "#src/models/party.js";
import type { PartyList } from "#src/models/partyList.js";

type PartyId = Party["id"];

interface OrderedPartySections {
  activePartyIds: PartyId[];
  archivedPartyIds: PartyId[];
  activeCount: number;
  archivedCount: number;
  pinnedActiveCount: number;
}

export function getOrderedPartySections(
  partyList: PartyList,
): OrderedPartySections {
  const partyIds = Object.keys(partyList.parties).filter(isValidDocumentId);
  const insertionOrder = new Map(
    partyIds.map((partyId, index) => [partyId, index]),
  );

  const activePartyIds: PartyId[] = [];
  const archivedPartyIds: PartyId[] = [];

  for (const partyId of partyIds) {
    if (isPartyArchived(partyList, partyId)) {
      archivedPartyIds.push(partyId);
      continue;
    }

    activePartyIds.push(partyId);
  }

  const sortPartyIds = (ids: PartyId[], includePinned: boolean) =>
    [...ids].sort((leftPartyId: PartyId, rightPartyId: PartyId) => {
      if (includePinned) {
        const leftPinned = Number(isPartyPinned(partyList, leftPartyId));
        const rightPinned = Number(isPartyPinned(partyList, rightPartyId));

        if (leftPinned !== rightPinned) {
          return rightPinned - leftPinned;
        }
      }

      const leftLastUsedAt = getPartyLastUsedAt(partyList, leftPartyId);
      const rightLastUsedAt = getPartyLastUsedAt(partyList, rightPartyId);

      if (leftLastUsedAt !== rightLastUsedAt) {
        return rightLastUsedAt - leftLastUsedAt;
      }

      return (
        (insertionOrder.get(leftPartyId) ?? 0) -
        (insertionOrder.get(rightPartyId) ?? 0)
      );
    });

  const orderedActivePartyIds = sortPartyIds(activePartyIds, true);
  const orderedArchivedPartyIds = sortPartyIds(archivedPartyIds, false);

  return {
    activePartyIds: orderedActivePartyIds,
    archivedPartyIds: orderedArchivedPartyIds,
    activeCount: orderedActivePartyIds.length,
    archivedCount: orderedArchivedPartyIds.length,
    pinnedActiveCount: orderedActivePartyIds.filter((partyId) =>
      isPartyPinned(partyList, partyId),
    ).length,
  };
}

export function isPartyPinned(partyList: PartyList, partyId: PartyId) {
  return partyList.pinnedParties?.[partyId] === true;
}

export function isPartyArchived(partyList: PartyList, partyId: PartyId) {
  return partyList.archivedParties?.[partyId] === true;
}

export function getPartyLastUsedAt(partyList: PartyList, partyId: PartyId) {
  if (partyList.lastUsedAt?.[partyId] !== undefined) {
    return partyList.lastUsedAt[partyId] ?? 0;
  }

  if (partyList.lastOpenedPartyId === partyId) {
    return Number.MAX_SAFE_INTEGER;
  }

  return 0;
}
