import { useState } from "react";

export type BalancesSortedBy =
  | "name"
  | "balance-ascending"
  | "balance-descending";

function isBalanceSortedBy(sortedBy: string): sortedBy is BalancesSortedBy {
  return ["name", "balance-ascending", "balance-descending"].includes(sortedBy);
}

const balanceSortedByKey = "balances-sorted-by";

function getBalanceSortedBy(): BalancesSortedBy {
  const value = localStorage.getItem(balanceSortedByKey);
  if (!value || !isBalanceSortedBy(value)) return "name";
  return value;
}

export function useBalancesSortedBy(): [
  BalancesSortedBy,
  (sorted: BalancesSortedBy) => void,
] {
  const [sortedBy, setSortedBy] = useState(getBalanceSortedBy);
  function setter(sortedBy: BalancesSortedBy) {
    setSortedBy(sortedBy);
    localStorage.setItem(balanceSortedByKey, sortedBy);
  }
  return [sortedBy, setter];
}
