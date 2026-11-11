import { useCurrentPartyId } from "#src/hooks/useCurrentPartyId.ts";
import type { PartyEntity } from "#src/lib/data/entities.ts";
import { requireAvailable } from "#src/lib/data/availability.ts";
import { useFateClient, useView } from "react-fate";
import { view } from "@nkzw/fate";
import { CurrencyText } from "#src/components/CurrencyText.js";
import type { Balance } from "#src/models/expense.js";
import type { PartyParticipant } from "#src/models/party.js";
import { cn } from "@trizum/ui/utils";

const PartyCurrencyView = view<PartyEntity>()({
  id: true,
  available: true,
  currency: true,
});

interface BalanceItemProps {
  participant: PartyParticipant;
  stats: Balance["stats"];
  visualRatio: number;
}

export function BalanceItem({ participant, stats, visualRatio }: BalanceItemProps) {
  const client = useFateClient();
  const partyId = useCurrentPartyId();

  const party = requireAvailable(
    useView(PartyCurrencyView, client.ref<PartyEntity>("Party", partyId, PartyCurrencyView)),
  );

  const balance = stats.balance;
  const isNegative = balance < 0;

  const participantNode = (
    <div className={cn("flex items-center justify-end", isNegative && "justify-start")}>
      <span className="text-lg font-medium">{participant.name}</span>
    </div>
  );

  const balanceNode = (
    <div className={cn("relative flex items-center justify-start", isNegative && "justify-end")}>
      <div
        className={cn(
          "h-10 rounded-lg bg-success-300 dark:bg-success-600",
          isNegative && "bg-danger-300 dark:bg-danger-700",
        )}
        style={{
          width: `${Math.abs(visualRatio) * 100}%`,
        }}
      />

      <CurrencyText
        amount={stats.balance}
        currency={party.currency}
        variant="inherit"
        className={cn(
          "absolute top-1/2 -translate-y-1/2 text-lg font-bold leading-none",
          isNegative ? "right-2" : "left-2",
        )}
      />
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-4">
      {isNegative ? (
        <>
          {balanceNode}
          {participantNode}
        </>
      ) : (
        <>
          {participantNode}
          {balanceNode}
        </>
      )}
    </div>
  );
}
