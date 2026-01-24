import {
  redirect,
  type ParsedLocation,
  type RegisteredRouter,
  type RouterContextOptions,
} from "@tanstack/react-router";
import { cache } from "@trizum/sdk";
import type { DocumentId } from "@trizum/sdk";
import type { Party } from "#src/models/party.js";
import type { PartyList } from "#src/models/partyList.js";

export async function guardPartyExists(
  partyId: string,
  { client }: RouterContextOptions<RegisteredRouter["routeTree"]>["context"],
) {
  const party = await cache.readAsync<Party>(client, partyId as DocumentId);

  if (!party) {
    throw redirect({ to: "/" });
  }

  return party;
}

export async function guardPartyListExists({
  client,
}: RouterContextOptions<RegisteredRouter["routeTree"]>["context"]) {
  const partyListId = client.partyList.getOrCreate();
  const partyList = await cache.readAsync<PartyList>(client, partyListId);

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
