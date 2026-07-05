const EXPENSE_EDIT_OPENED_FROM_DETAIL_STATE_KEY = "expenseEditOpenedFromDetail";

export function markExpenseEditOpenedFromDetailState<TState extends object>(state: TState) {
  return {
    ...state,
    [EXPENSE_EDIT_OPENED_FROM_DETAIL_STATE_KEY]: true,
  };
}

export function hasExpenseEditOpenedFromDetailState(state: unknown) {
  return (
    typeof state === "object" &&
    state !== null &&
    EXPENSE_EDIT_OPENED_FROM_DETAIL_STATE_KEY in state &&
    state[EXPENSE_EDIT_OPENED_FROM_DETAIL_STATE_KEY] === true
  );
}
