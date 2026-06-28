import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useNavigate } from "@tanstack/react-router";
import { CurrencyText } from "#src/components/CurrencyText.js";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.js";
import { useCurrentParty } from "#src/hooks/useParty.js";
import type { PartyParticipant } from "#src/models/party.js";
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.js";

interface BalanceActionItemProps {
  fromId: PartyParticipant["id"];
  toId: PartyParticipant["id"];
  amount: number;
  canTransferDebt?: boolean;
}

export function BalanceActionItem({
  fromId,
  toId,
  amount,
  canTransferDebt = false,
}: BalanceActionItemProps) {
  const { party } = useCurrentParty();
  const me = useCurrentParticipant();
  const from = party.participants[fromId];
  const to = party.participants[toId];
  const isFromMe = fromId === me.id;
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-white p-4 dark:bg-accent-900">
      <div className="flex">
        <div className="flex flex-1 flex-col">
          <span className="text-lg text-accent-400">
            {from.name} {fromId === me.id ? t`(me)` : ""}
          </span>
          <span className="text-sm text-accent-700 dark:text-accent-300">
            <Trans>owes</Trans>
          </span>
          <span className="text-lg text-accent-400">
            {to.name} {toId === me.id ? t`(me)` : ""}
          </span>
        </div>

        <div className="flex flex-shrink-0 items-center">
          <CurrencyText currency={party.currency} amount={Math.abs(amount)} className="text-xl" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Button
          color="input-like"
          className="h-8 rounded-lg px-3 font-semibold"
          onPress={() =>
            void navigate({
              to: "/party/$partyId/pay",
              params: {
                partyId: party.id,
              },
              search: {
                fromId,
                toId,
                amount: Math.abs(amount),
              },
            })
          }
        >
          {isFromMe ? <Trans>Pay</Trans> : <Trans>Mark as paid</Trans>}
        </Button>

        {isFromMe && canTransferDebt ? (
          <Button
            color="transparent"
            className="h-8 rounded-lg px-3 text-sm font-medium text-accent-500 hover:text-accent-400 dark:text-accent-300 dark:hover:text-accent-200"
            onPress={() =>
              void navigate({
                to: "/party/$partyId/transfer-debt",
                params: {
                  partyId: party.id,
                },
                search: {
                  fromId,
                  toId,
                  amount: Math.abs(amount),
                },
              })
            }
          >
            <Icon
              icon="lucide.corner-down-right"
              width={16}
              height={16}
              className="mr-2 flex-shrink-0"
            />
            <Trans>Transfer to another party</Trans>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
