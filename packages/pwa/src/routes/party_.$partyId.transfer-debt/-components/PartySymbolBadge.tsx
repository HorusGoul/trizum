import type { Party } from "#src/models/party.ts";
import { cn } from "#src/ui/utils.ts";

export function PartySymbolBadge({ party, className }: { party: Party; className?: string }) {
  const symbol = party.symbol || party.name.charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-accent-200 bg-accent-950 text-lg font-semibold text-white dark:border-accent-700/20 dark:bg-black/20 dark:text-accent-50",
        className,
      )}
    >
      <span className="pt-0.5">{symbol}</span>
    </div>
  );
}
