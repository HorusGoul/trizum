import { useEffect, useRef } from "react";
import { List, useDynamicRowHeight, useListRef, type RowComponentProps } from "react-window";
import { useScrollRestorationCache } from "#src/hooks/useScrollRestorationCache.ts";
import type { Expense } from "#src/models/expense.js";
import { Skeleton } from "@trizum/ui/Skeleton";
import { ExpenseItem } from "./ExpenseItem.js";

const EXPENSE_ROW_GAP = 16;
const EXPENSE_LIST_BOTTOM_SPACER_HEIGHT = 120;
const EXPENSE_LIST_DEFAULT_ROW_HEIGHT = 96 + EXPENSE_ROW_GAP;

interface ExpenseListRowProps {
  expenses: Expense[];
  partyId: string;
  loaderIndex: number;
  spacerIndex: number;
}

function ExpenseListRow({
  ariaAttributes,
  expenses,
  index,
  loaderIndex,
  partyId,
  spacerIndex,
  style,
}: RowComponentProps<ExpenseListRowProps>) {
  if (index === spacerIndex) {
    return (
      <div aria-hidden="true" style={{ ...style, height: EXPENSE_LIST_BOTTOM_SPACER_HEIGHT }} />
    );
  }

  return (
    <div
      {...ariaAttributes}
      style={{
        ...style,
        boxSizing: "border-box",
        paddingBottom: EXPENSE_ROW_GAP,
      }}
    >
      {index === loaderIndex ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <ExpenseItem partyId={partyId} expense={expenses[index]} />
      )}
    </div>
  );
}

export function VirtualizedExpenseList({
  expenses,
  partyId,
  hasNext,
  isLoadingNext,
  loadNext,
}: {
  expenses: Expense[];
  partyId: string;
  hasNext: boolean;
  isLoadingNext: boolean;
  loadNext: () => void;
}) {
  const listRef = useListRef(null);
  const scrollRestorationCache = useScrollRestorationCache(`party-${partyId}-expense-list`);

  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: EXPENSE_LIST_DEFAULT_ROW_HEIGHT,
    key: partyId,
    initialRowHeights: expenses.map(
      (expense) =>
        scrollRestorationCache.initialRowHeights.get(expense.id) ?? EXPENSE_LIST_DEFAULT_ROW_HEIGHT,
    ),
  });

  const loaderIndex = hasNext ? expenses.length : -1;
  const spacerIndex = expenses.length + (hasNext ? 1 : 0);
  const rowCount = spacerIndex + 1;
  const requestedNextPageRef = useRef(false);

  // Restore pixels against the same measured layout, keyed by expense rather than row index.
  useEffect(() => {
    scrollRestorationCache.setRowHeights(
      new Map(
        expenses.map((expense, index) => [
          expense.id,
          rowHeight.getRowHeight(index) ?? EXPENSE_LIST_DEFAULT_ROW_HEIGHT,
        ]),
      ),
    );
  }, [expenses, rowHeight, scrollRestorationCache]);

  return (
    <div className="min-h-0 flex-1">
      <List
        className="no-scrollbar h-full overflow-y-auto"
        data-testid="expense-log-list"
        defaultScrollOffset={scrollRestorationCache.initialScrollTop}
        listRef={listRef}
        onRowsRendered={(visibleRows) => {
          if (!isLoadingNext) {
            requestedNextPageRef.current = false;
          }

          const shouldLoadNext =
            loaderIndex >= 0 &&
            visibleRows.stopIndex >= loaderIndex &&
            !isLoadingNext &&
            !requestedNextPageRef.current;

          if (shouldLoadNext) {
            requestedNextPageRef.current = true;
            loadNext();
          }
        }}
        onScroll={(event) => {
          scrollRestorationCache.setScrollTop(event.currentTarget.scrollTop);
        }}
        overscanCount={10}
        rowComponent={ExpenseListRow}
        rowCount={rowCount}
        rowHeight={rowHeight}
        rowProps={{ expenses, partyId, loaderIndex, spacerIndex }}
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
}
