import {
  redirect,
  type ParsedLocation,
  type RegisteredRouter,
  type RouterContextOptions,
} from "@tanstack/react-router";
import {
  readPartyList,
  readPartyResult,
  waitForExpenseEntityInFate,
  waitForPartyInFate,
  writeExpenseEntityToFateCache,
  type DataReadResult,
} from "#src/lib/data/fateAppData.ts";
import type { Party } from "#src/models/party.ts";

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

export async function guardExpenseExists(expenseId: string, { data }: RouterContext) {
  const localExpense = await waitForExpenseEntityInFate(data.client, expenseId, {
    timeoutMs: data.hasRemoteSync ? 2_000 : 8_000,
  });

  if (localExpense) {
    return localExpense;
  }

  if (!data.hasRemoteSync || !data.settledClient) {
    throw new Error(`Expense ${expenseId} not found`);
  }

  const settledExpense = await waitForExpenseEntityInFate(data.settledClient, expenseId, {
    timeoutMs: 30_000,
  });

  if (!settledExpense) {
    throw new Error(`Expense ${expenseId} not found`);
  }

  writeExpenseEntityToFateCache(data.client, settledExpense);

  return settledExpense;
}

async function readPartyResultForGuard(
  partyId: string,
  data: RouterContext["data"],
): Promise<DataReadResult<Party>> {
  const localResult = await readPartyResult(data.client, partyId);

  if (localResult.status !== "notFound" || !data.hasRemoteSync || !data.settledClient) {
    return localResult;
  }

  try {
    const party = await waitForPartyInFate(data.settledClient, partyId);

    if (party) {
      return {
        status: "found",
        value: party,
      };
    }
  } catch (error) {
    return {
      error,
      status: "error",
    };
  }

  return {
    status: "notFound",
  };
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
