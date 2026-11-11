import { Trans, useLingui } from "@lingui/react/macro";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import type { Expense } from "#src/models/expense.ts";
import { Icon } from "@trizum/ui/Icon";

export function ExchangeRate({
  originalAmount,
  exchangeRate,
}: Pick<Expense, "originalAmount" | "exchangeRate">) {
  const { party } = useCurrentParty();
  const { t, i18n } = useLingui();

  if (!originalAmount || exchangeRate == null) return null;

  const currency = originalAmount.currency;
  const partyCurrency = party.currency;
  const rate = i18n.number(exchangeRate, { maximumSignificantDigits: 12 });

  return (
    <dl className="flex items-center gap-2">
      <dt>
        <Icon icon="lucide.arrow-right-left" aria-label={t`Exchange rate`} />
      </dt>
      <dd className="font-medium">
        <Trans>
          1 {currency} = {rate} {partyCurrency}
        </Trans>
      </dd>
    </dl>
  );
}
