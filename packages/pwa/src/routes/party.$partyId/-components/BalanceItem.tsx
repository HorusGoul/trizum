import { CurrencyText } from "#src/components/CurrencyText.js";
import { useCurrentParty } from "#src/hooks/useParty.js";
import type { Balance } from "#src/models/expense.js";
import type { PartyParticipant } from "#src/models/party.js";
import { cn } from "#src/ui/utils.js";

interface BalanceItemProps {
  participant: PartyParticipant;
  stats: Balance["stats"];
  visualRatio: number;
}

export function BalanceItem({ participant, stats, visualRatio }: BalanceItemProps) {
  const { party } = useCurrentParty();

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
