import {
  redirect,
  type ParsedLocation,
  type RegisteredRouter,
  type RouterContextOptions,
} from "@tanstack/react-router";
import { readParty, readPartyList } from "#src/lib/data/fateAppData.ts";

type RouterContext = RouterContextOptions<RegisteredRouter["routeTree"]>["context"];

export async function guardPartyExists(partyId: string, { data }: RouterContext) {
  const party = await readParty(data.client, partyId);

  if (!party) {
    throw redirect({ to: "/" });
  }

  return party;
}

export async function guardPartyListExists({ data }: RouterContext) {
  const partyList = await readPartyList(data.client, data.userId);

  if (!partyList) {
    throw redirect({ to: "/" });
  }

  return partyList;
}

export async function guardParticipatingInParty(
  partyId: string,
  context: RouterContext,
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
