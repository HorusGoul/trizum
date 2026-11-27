import { Trans } from "@lingui/react/macro";
import { Link } from "react-aria-components";
import { CurrencyText } from "#src/components/CurrencyText.js";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.js";
import { useParty } from "#src/hooks/useParty.js";
import {
  getExpenseTotalAmount,
  getImpactOnBalanceForUser,
  type Expense,
} from "#src/models/expense.js";
import { cn } from "@trizum/ui/utils";

export function ExpenseItem({ partyId, expense }: { partyId: string; expense: Expense }) {
  const { party } = useParty(partyId);
  const participant = useCurrentParticipant();

  return (
    <Link
      href={{
        to: "/party/$partyId/expense/$expenseId",
        params: {
          partyId,
          expenseId: expense.id,
        },
      }}
      className={({ isPressed, isFocusVisible, isHovered, defaultClassName }) =>
        cn(
          defaultClassName,
          "shadow-surface flex min-h-24 w-full scale-100 rounded-3xl bg-white px-5 py-4 text-start outline-hidden transition-all duration-200 ease-in-out dark:bg-neutral-900",
          (isHovered || isFocusVisible) && "bg-neutral-50 dark:bg-neutral-800",
          isFocusVisible && "ring-2 ring-accent-500 dark:ring-accent-400",
          isPressed && "scale-[0.97] bg-neutral-50 dark:bg-neutral-800",
        )
      }
    >
      <div className="flex flex-1 flex-col">
        <span className="font-medium">{expense.name}</span>
      </div>

      <div className="flex shrink-0 flex-col text-end">
        <CurrencyText
          amount={expense.originalAmount?.amount ?? getExpenseTotalAmount(expense)}
          currency={expense.originalAmount?.currency ?? party.currency}
          className="font-medium"
        />
        {expense.originalAmount ? (
          <CurrencyText
            amount={getExpenseTotalAmount(expense)}
            currency={party.currency}
            className="text-sm text-neutral-600 dark:text-neutral-400"
            variant="inherit"
          />
        ) : null}
        <span className="text-sm text-neutral-600 dark:text-neutral-400">
          {expense.paidAt.toLocaleDateString()}
        </span>
        <span className="text-sm">
          <Trans>
            Impact on my balance:&nbsp;
            <CurrencyText
              amount={getImpactOnBalanceForUser(expense, participant.id)}
              currency={party.currency}
              variant="diff"
            />
          </Trans>
        </span>
      </div>
    </Link>
  );
}
