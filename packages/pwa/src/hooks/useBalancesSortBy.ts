import type { BalancesSortedBy } from "#src/models/party.ts";
import { useCurrentParty } from "./useParty";
import { useCurrentParticipant } from "./useCurrentParticipant";

const defaultBalancesSortedBy: BalancesSortedBy = "name";

function isBalanceSortedBy(sortedBy: string): sortedBy is BalancesSortedBy {
  return ["name", "balance-ascending", "balance-descending"].includes(sortedBy);
}

export function useBalancesSortedBy(): [
  BalancesSortedBy,
  (sorted: BalancesSortedBy) => void,
] {
  const { setParticipantDetails } = useCurrentParty();
  const participant = useCurrentParticipant();
  const sortedBy =
    participant.balancesSortedBy &&
    isBalanceSortedBy(participant.balancesSortedBy)
      ? participant.balancesSortedBy
      : defaultBalancesSortedBy;

  function setter(sortedBy: BalancesSortedBy) {
    void setParticipantDetails(participant.id, {
      balancesSortedBy: sortedBy,
    });
  }

  return [sortedBy, setter];
}
