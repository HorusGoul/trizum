import { CurrencyText } from "#src/components/CurrencyText.tsx";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import type { Expense } from "#src/models/expense.ts";
import { Trans, useLingui } from "@lingui/react/macro";

export function Amount({
  amount,
  originalAmount,
  exchangeRate,
}: { amount: number } & Pick<Expense, "originalAmount" | "exchangeRate">) {
  const { party } = useCurrentParty();
  const { i18n } = useLingui();
  const currency = originalAmount?.currency;
  const partyCurrency = party.currency;

  const rate =
    exchangeRate == null ? "" : i18n.number(exchangeRate, { maximumSignificantDigits: 12 });

  return (
    <div className="flex flex-col gap-2">
      <CurrencyText amount={amount} currency={partyCurrency} className="text-4xl font-bold" />
      {originalAmount && (
        <div className="text-accent-700 dark:text-accent-200 text-sm">
          <CurrencyText
            amount={originalAmount.amount}
            currency={originalAmount.currency}
            variant="inherit"
          />{" "}
          ({currency})
          {exchangeRate != null && (
            <p>
              <Trans>
                1 {currency} = {rate} {partyCurrency}
              </Trans>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
