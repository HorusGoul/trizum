import type { Party } from "#src/models/party.js";
import {
  redirect,
  type ParsedLocation,
  type RegisteredRouter,
  type RouterContextOptions,
} from "@tanstack/react-router";
import { type PartyList } from "#src/models/partyList.js";

export async function guardPartyExists(
  partyId: string,
  { data }: RouterContextOptions<RegisteredRouter["routeTree"]>["context"],
) {
  // SAFETY: The router owns this document ID and its Party/PartyList contract; the shared cache erases those document types.
  const party = (await data.read<Party>(partyId)) as Party | undefined;

  if (!party) {
    throw redirect({ to: "/" });
  }

  return party;
}

export async function guardPartyListExists({
  data,
}: RouterContextOptions<RegisteredRouter["routeTree"]>["context"]) {
  const partyListId = data.activeProfileId();
  // SAFETY: The router owns this document ID and its Party/PartyList contract; the shared cache erases those document types.
  const partyList = (await data.read<PartyList>(partyListId)) as PartyList | undefined;

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
