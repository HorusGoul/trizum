import { z } from "zod";

const EXPENSE_EDIT_OPENED_FROM_DETAIL_STATE_KEY = "expenseEditOpenedFromDetail";

export function markExpenseEditOpenedFromDetailState<TState extends object>(state: TState) {
  return {
    ...state,
    [EXPENSE_EDIT_OPENED_FROM_DETAIL_STATE_KEY]: true,
  };
}

export function hasExpenseEditOpenedFromDetailState(
  state: unknown,
): state is { [EXPENSE_EDIT_OPENED_FROM_DETAIL_STATE_KEY]: true } {
  return expenseEditDetailStateSchema.safeParse(state).success;
}

const expenseEditDetailStateSchema = z.object({
  [EXPENSE_EDIT_OPENED_FROM_DETAIL_STATE_KEY]: z.literal(true),
});
