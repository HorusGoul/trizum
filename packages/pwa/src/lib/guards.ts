import {
  redirect,
  type ParsedLocation,
  type RegisteredRouter,
  type RouterContextOptions,
} from "@tanstack/react-router";
import {
  readPartyList,
  readPartyResult,
  toParty,
  waitForExpenseEntityInFate,
  waitForPartyEntitiesInFate,
  writeExpenseEntityToFateCache,
  writePartyEntitiesToFateCache,
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
    requestOptions: { mode: "network-only" },
    timeoutMs: 60_000,
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
  let localResult: DataReadResult<Party>;

  try {
    const localRead = await withGuardTimeout(
      readPartyResult(data.client, partyId),
      data.hasRemoteSync ? 2_000 : 8_000,
    );

    if (!localRead) {
      localResult = {
        status: "notFound",
      };
    } else {
      localResult = localRead;
    }
  } catch (error) {
    if (!data.hasRemoteSync || !data.settledClient) {
      return {
        error,
        status: "error",
      };
    }

    localResult = {
      status: "notFound",
    };
  }

  if (localResult.status === "found" || !data.hasRemoteSync || !data.settledClient) {
    return localResult;
  }

  try {
    const partySnapshot = await waitForPartyEntitiesInFate(data.settledClient, partyId, {
      requestOptions: { mode: "network-only" },
      timeoutMs: 60_000,
    });

    if (partySnapshot) {
      writePartyEntitiesToFateCache(data.client, partySnapshot);

      return {
        status: "found",
        value: toParty(partySnapshot.party, partySnapshot.participants),
      };
    }
  } catch (error) {
    if (localResult.status === "error") {
      return localResult;
    }

    return {
      error,
      status: "error",
    };
  }

  if (localResult.status === "error") {
    return localResult;
  }

  return {
    status: "notFound",
  };
}

export async function guardPartyListExists({ data }: RouterContext) {
  const partyList = await withGuardTimeout(
    readPartyList(data.client, data.userId),
    data.hasRemoteSync ? 2_000 : 8_000,
  );

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

function withGuardTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    promise.finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }),
    new Promise<undefined>((resolve) => {
      timeoutId = setTimeout(() => resolve(undefined), timeoutMs);
    }),
  ]);
}
