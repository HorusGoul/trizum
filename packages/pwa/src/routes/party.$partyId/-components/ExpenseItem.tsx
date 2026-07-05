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
import { cn } from "#src/ui/utils.js";

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
          "flex min-h-24 w-full scale-100 rounded-xl bg-white p-4 text-start outline-hidden transition-all duration-200 ease-in-out dark:bg-accent-900",
          (isHovered || isFocusVisible) && "shadow-md dark:bg-accent-800 dark:shadow-none",
          isPressed && "scale-95 bg-white/90 shadow-lg dark:bg-accent-700/90 dark:shadow-none",
        )
      }
    >
      <div className="flex flex-1 flex-col">
        <span className="font-medium">{expense.name}</span>
      </div>

      <div className="flex shrink-0 flex-col text-end">
        <CurrencyText
          amount={getExpenseTotalAmount(expense)}
          currency={party.currency}
          className="font-medium"
        />
        <span className="text-sm">{expense.paidAt.toLocaleDateString()}</span>
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
