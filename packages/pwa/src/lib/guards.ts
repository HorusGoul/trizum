import { view } from "@nkzw/fate";
import {
  redirect,
  type ParsedLocation,
  type RegisteredRouter,
  type RouterContextOptions,
} from "@tanstack/react-router";
import type { PartyEntity, ProfileEntity, SessionEntity } from "./data/entities.ts";

const PartyAccessView = view<PartyEntity>()({
  id: true,
  available: true,
  participants: true,
  chunkRefs: true,
});

const ProfileAccessView = view<ProfileEntity>()({
  id: true,
  available: true,
  parties: true,
  participantInParties: true,
});

const SessionView = view<SessionEntity>()({ profileId: true });

type RouteContext = RouterContextOptions<RegisteredRouter["routeTree"]>["context"];

export async function guardPartyExists(partyId: string, { client }: RouteContext) {
  const { data: party } = await client.readView(
    PartyAccessView,
    client.ref<PartyEntity>("Party", partyId, PartyAccessView),
  );

  if (!party.available) throw redirect({ to: "/" });

  return party;
}

export async function guardPartyListExists({ client }: RouteContext) {
  const { data: session } = await client.readView(
    SessionView,
    client.ref<SessionEntity>("Session", "current", SessionView),
  );

  const { data: partyList } = await client.readView(
    ProfileAccessView,
    client.ref<ProfileEntity>("Profile", session.profileId, ProfileAccessView),
  );

  if (!partyList.available) throw redirect({ to: "/" });

  return partyList;
}

export async function guardParticipatingInParty(
  partyId: string,
  context: RouteContext,
  location: ParsedLocation,
) {
  const [party, partyList] = await Promise.all([
    guardPartyExists(partyId, context),
    guardPartyListExists(context),
  ]);

  if (
    partyList.parties[party.id] !== true ||
    partyList.participantInParties[party.id] === undefined
  ) {
    throw redirect({
      to: "/party/$partyId/who",
      params: { partyId },
      search: { redirectTo: location.href },
    });
  }

  return { party, partyList };
}
