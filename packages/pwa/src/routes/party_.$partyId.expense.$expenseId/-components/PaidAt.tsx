import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import type { Expense } from "#src/models/expense.js";
import { Icon } from "#src/ui/Icon.js";

export function PaidAt({ paidAt }: Pick<Expense, "paidAt">) {
  const { i18n } = useLingui();

  return (
    <dl className="flex items-center gap-2">
      <dt>
        <Icon icon="lucide.calendar" aria-label={t`Paid at`} />
      </dt>
      <dd className="font-medium">{paidAt.toLocaleDateString(i18n.locale)}</dd>
    </dl>
  );
}
