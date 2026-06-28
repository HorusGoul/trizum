import { t } from "@lingui/core/macro";
import { Fragment } from "react";
import { CurrencyText } from "#src/components/CurrencyText.tsx";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.ts";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import type { Expense } from "#src/models/expense.js";
import { Icon } from "#src/ui/Icon.js";

export function PaidBy({ paidBy }: Pick<Expense, "paidBy">) {
  const { party } = useCurrentParty();
  const currentParticipant = useCurrentParticipant();
  const hasMultiple = Object.keys(paidBy).length > 1;

  const paidByElements = Object.entries(paidBy).map(([userId, amount]) => {
    const participant = party.participants[userId];
    const isMe = participant.id === currentParticipant.id;
    const nameNode = (
      <div className="inline-flex items-center gap-1">
        {participant.name}

        {isMe ? (
          <span className="h-4 rounded-sm bg-accent-500 px-1 text-xs font-semibold uppercase text-accent-50">
            {t`Me`}
          </span>
        ) : null}
      </div>
    );

    if (hasMultiple) {
      return (
        <Fragment key={userId}>
          {nameNode}{" "}
          <span>
            (<CurrencyText amount={amount} currency={party.currency} />)
          </span>
        </Fragment>
      );
    }

    return <Fragment key={userId}>{nameNode}</Fragment>;
  });

  return (
    <dl className="flex">
      <dt className="flex items-center gap-2">
        <Icon icon={hasMultiple ? "lucide.users" : "lucide.user"} aria-hidden="true" />

        <span className="font-medium">{t`Paid by`}</span>
      </dt>
      <dd className="font-semibold">
        &nbsp;
        {paidByElements}
      </dd>
    </dl>
  );
}
