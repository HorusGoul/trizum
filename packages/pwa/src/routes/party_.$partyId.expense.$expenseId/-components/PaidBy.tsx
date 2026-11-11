import { useCurrentPartyId } from "#src/hooks/useCurrentPartyId.ts";
import type { PartyEntity } from "#src/lib/data/entities.ts";
import { requireAvailable } from "#src/lib/data/availability.ts";
import { useFateClient, useView } from "react-fate";
import { view } from "@nkzw/fate";
import { t } from "@lingui/core/macro";
import { Fragment } from "react";
import { CurrencyText } from "#src/components/CurrencyText.tsx";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.ts";
import type { Expense } from "#src/models/expense.js";
import { Icon } from "@trizum/ui/Icon";

const PartyParticipantAmountsView = view<PartyEntity>()({
  id: true,
  available: true,
  participants: true,
  currency: true,
});

export function PaidBy({ paidBy }: Pick<Expense, "paidBy">) {
  const client = useFateClient();
  const partyId = useCurrentPartyId();

  const party = requireAvailable(
    useView(
      PartyParticipantAmountsView,
      client.ref<PartyEntity>("Party", partyId, PartyParticipantAmountsView),
    ),
  );

  const currentParticipant = useCurrentParticipant();
  const hasMultiple = Object.keys(paidBy).length > 1;

  const paidByElements = Object.entries(paidBy).map(([userId, amount]) => {
    const participant = party.participants[userId];
    const isMe = participant.id === currentParticipant.id;

    const nameNode = (
      <div className="inline-flex items-center gap-1">
        {participant.name}

        {isMe ? (
          <span className="bg-accent-500 text-accent-50 h-4 rounded-xs px-1 text-xs font-semibold uppercase">
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
