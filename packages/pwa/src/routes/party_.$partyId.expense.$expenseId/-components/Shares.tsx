import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { CurrencyText } from "#src/components/CurrencyText.tsx";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.ts";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import { getExpenseUnitShares, type Expense } from "#src/models/expense.js";
import { Icon } from "@trizum/ui/Icon";

export function Shares(expense: Pick<Expense, "shares" | "paidBy" | "originalAmount">) {
  const { i18n } = useLingui();
  const unitAmounts = getExpenseUnitShares(expense);
  const { party } = useCurrentParty();
  const currentParticipant = useCurrentParticipant();

  return (
    <dl className="flex flex-col gap-4">
      <dt className="flex items-center gap-2">
        <Icon icon="lucide.split" aria-hidden="true" />
        <span className="font-medium">{t`Shares`}</span>
      </dt>

      <dd className="-mx-2 overflow-hidden rounded-lg">
        <ul>
          {Object.entries(unitAmounts)
            .sort(([a], [b]) =>
              party.participants[a].name.localeCompare(party.participants[b].name, i18n.locale),
            )
            .map(([userId, amount]) => {
              const isMe = userId === currentParticipant.id;

              const original =
                expense.originalAmount && expense.shares[userId].originalAmount != null
                  ? {
                      amount: expense.shares[userId].originalAmount,
                      currency: expense.originalAmount.currency,
                    }
                  : undefined;

              return (
                <li
                  key={userId}
                  className="flex justify-between bg-neutral-50 p-2 px-3 even:bg-neutral-50/80 dark:bg-neutral-900 dark:even:bg-neutral-900/60"
                >
                  <span className="flex items-center gap-1 font-medium">
                    {party.participants[userId].name}

                    {isMe ? (
                      <span className="h-4 rounded-xs bg-neutral-500 px-1 text-xs font-semibold text-neutral-50 uppercase">
                        {t`Me`}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex flex-col items-end">
                    <CurrencyText
                      amount={original?.amount ?? amount}
                      currency={original?.currency ?? party.currency}
                      className="font-semibold"
                    />
                    {original ? (
                      <CurrencyText
                        amount={amount}
                        currency={party.currency}
                        className="text-xs text-neutral-600 dark:text-neutral-300"
                        variant="inherit"
                      />
                    ) : null}
                  </span>
                </li>
              );
            })}
        </ul>
      </dd>
    </dl>
  );
}
