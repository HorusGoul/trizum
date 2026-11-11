import { mutationResult } from "#src/lib/data/mutationResult.ts";
import { useFateClient } from "react-fate";
import type { BalancesSortedBy } from "#src/models/party.ts";
import { useCurrentPartyId } from "./useCurrentPartyId.ts";
import { useCurrentParticipant } from "./useCurrentParticipant";

const defaultBalancesSortedBy: BalancesSortedBy = "name";

function isBalanceSortedBy(sortedBy: string): sortedBy is BalancesSortedBy {
  return ["name", "balance-ascending", "balance-descending"].includes(sortedBy);
}

export function useBalancesSortedBy(): [BalancesSortedBy, (sorted: BalancesSortedBy) => void] {
  const client = useFateClient();
  const partyId = useCurrentPartyId();
  const participant = useCurrentParticipant();

  const sortedBy =
    participant.balancesSortedBy && isBalanceSortedBy(participant.balancesSortedBy)
      ? participant.balancesSortedBy
      : defaultBalancesSortedBy;

  async function setter(sortedBy: BalancesSortedBy) {
    await mutationResult(
      client.mutations.party.setParticipantDetails({
        input: {
          partyId,
          parameters: [
            participant.id,
            {
              balancesSortedBy: sortedBy,
            },
          ],
        },
      }),
    );
  }

  return [sortedBy, setter];
}
