import {
  redirect,
  type ParsedLocation,
  type RegisteredRouter,
  type RouterContextOptions,
} from "@tanstack/react-router";
import { documentCache } from "./automerge/suspense-hooks";
import { getPartyListId } from "#src/models/partyList.js";
import type { DocumentId } from "@trizum/sdk";

export async function guardPartyExists(
  partyId: string,
  { repo }: RouterContextOptions<RegisteredRouter["routeTree"]>["context"],
) {
  const party = await documentCache.readAsync(repo, partyId as DocumentId);

  if (!party) {
    throw redirect({ to: "/" });
  }

  return party;
}

export async function guardPartyListExists({
  repo,
}: RouterContextOptions<RegisteredRouter["routeTree"]>["context"]) {
  const partyListId = getPartyListId(repo);
  const partyList = await documentCache.readAsync(repo, partyListId);

  if (!partyList) {
    throw redirect({ to: "/" });
  }

  return partyList;
}

export async function guardParticipatingInParty(
  partyId: string,
  context: RouterContextOptions<RegisteredRouter["routeTree"]>["context"],
  location: ParsedLocation,
) {
  const [party, partyList] = await Promise.all([
    guardPartyExists(partyId, context),
    guardPartyListExists(context),
  ]);

  const needsToJoin =
    partyList.parties[party.id] !== true ||
    partyList.participantInParties?.[party.id] === undefined;

  if (needsToJoin) {
    throw redirect({
      to: "/party/$partyId/who",
      params: { partyId },
      search: {
        redirectTo: location.href,
      },
    });
  }

  return { party, partyList };
}
