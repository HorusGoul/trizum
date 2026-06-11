import {
  redirect,
  type ParsedLocation,
  type RegisteredRouter,
  type RouterContextOptions,
} from "@tanstack/react-router";
import { readPartyList, readPartyResult } from "#src/lib/data/fateAppData.ts";

type RouterContext = RouterContextOptions<RegisteredRouter["routeTree"]>["context"];

export async function guardPartyExists(partyId: string, { data }: RouterContext) {
  const partyResult = await readPartyResultForGuard(partyId, data);

  if (partyResult.status === "notFound") {
    throw redirect({ to: "/" });
  }

  if (partyResult.status === "error") {
    throw partyResult.error;
  }

  return partyResult.value;
}

async function readPartyResultForGuard(partyId: string, data: RouterContext["data"]) {
  const localResult = await readPartyResult(data.client, partyId);

  if (localResult.status !== "notFound" || !data.hasRemoteSync || !data.settledClient) {
    return localResult;
  }

  const client = data.settledClient;
  const retryUntil = Date.now() + 8_000;

  while (true) {
    const result = await readPartyResult(client, partyId);

    if (result.status !== "notFound" || !data.hasRemoteSync || Date.now() >= retryUntil) {
      return result;
    }

    await sleep(250);
  }
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
