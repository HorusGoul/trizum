import { useEffect, useRef } from "react";
import { List, useListRef, type RowComponentProps } from "react-window";
import { useScrollRestorationCache } from "#src/hooks/useScrollRestorationCache.ts";
import type { Expense } from "#src/models/expense.js";
import { Skeleton } from "#src/ui/Skeleton.tsx";
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
    return <div aria-hidden="true" style={style} />;
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
  const loaderIndex = hasNext ? expenses.length : -1;
  const spacerIndex = expenses.length + (hasNext ? 1 : 0);
  const rowCount = spacerIndex + 1;
  const requestedNextPageRef = useRef(false);

  useEffect(() => {
    const listElement = listRef.current?.element;
    if (!listElement) {
      return;
    }

    const rAF = window.requestAnimationFrame(() => {
      listElement.scrollTop = scrollRestorationCache.initialScrollTop;
    });

    return () => {
      cancelAnimationFrame(rAF);
    };
  }, [listRef, scrollRestorationCache.initialScrollTop]);

  useEffect(() => {
    const listElement = listRef.current?.element;
    if (!listElement) {
      return;
    }

    return () => {
      scrollRestorationCache.setScrollTop(listElement.scrollTop);
    };
  }, [listRef, scrollRestorationCache]);

  return (
    <div className="min-h-0 flex-1">
      <List
        className="no-scrollbar h-full overflow-y-auto"
        data-testid="expense-log-list"
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
        rowHeight={(index) =>
          index === spacerIndex
            ? EXPENSE_LIST_BOTTOM_SPACER_HEIGHT
            : EXPENSE_LIST_DEFAULT_ROW_HEIGHT
        }
        rowProps={{ expenses, partyId, loaderIndex, spacerIndex }}
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
}
