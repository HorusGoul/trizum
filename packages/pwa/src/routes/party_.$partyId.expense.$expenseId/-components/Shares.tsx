import { useCurrentPartyId } from "#src/hooks/useCurrentPartyId.ts";
import type { PartyEntity } from "#src/lib/data/entities.ts";
import { requireAvailable } from "#src/lib/data/availability.ts";
import { useFateClient, useView } from "react-fate";
import { view } from "@nkzw/fate";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { CurrencyText } from "#src/components/CurrencyText.tsx";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.ts";
import { getExpenseUnitShares } from "#src/models/expense.js";
import type { Expense } from "#src/models/expense.js";
import { Icon } from "@trizum/ui/Icon";

const PartyParticipantAmountsView = view<PartyEntity>()({
  id: true,
  available: true,
  participants: true,
  currency: true,
});

export function Shares(expense: Pick<Expense, "shares" | "paidBy">) {
  const client = useFateClient();
  const partyId = useCurrentPartyId();

  const { i18n } = useLingui();
  const unitAmounts = getExpenseUnitShares(expense);

  const party = requireAvailable(
    useView(
      PartyParticipantAmountsView,
      client.ref<PartyEntity>("Party", partyId, PartyParticipantAmountsView),
    ),
  );

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

              return (
                <li
                  key={userId}
                  className="bg-accent-50 even:bg-accent-50/80 dark:bg-accent-900 dark:even:bg-accent-900/60 flex justify-between p-2 px-3"
                >
                  <span className="flex items-center gap-1 font-medium">
                    {party.participants[userId].name}

                    {isMe ? (
                      <span className="bg-accent-500 text-accent-50 h-4 rounded-xs px-1 text-xs font-semibold uppercase">
                        {t`Me`}
                      </span>
                    ) : null}
                  </span>
                  <CurrencyText
                    amount={amount}
                    currency={party.currency}
                    className="font-semibold"
                  />
                </li>
              );
            })}
        </ul>
      </dd>
    </dl>
  );
}
