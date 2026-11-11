import { CurrencyText } from "#src/components/CurrencyText.tsx";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import type { Expense } from "#src/models/expense.ts";

export function Amount({
  amount,
  originalAmount,
}: { amount: number } & Pick<Expense, "originalAmount">) {
  const { party } = useCurrentParty();

  return (
    <div className="flex flex-col gap-2">
      <CurrencyText
        amount={originalAmount?.amount ?? amount}
        currency={originalAmount?.currency ?? party.currency}
        className="text-4xl font-bold"
      />
      {originalAmount && (
        <CurrencyText
          amount={amount}
          currency={party.currency}
          className="text-accent-600 dark:text-accent-300 text-2xl font-medium"
          variant="inherit"
        />
      )}
    </div>
  );
}
