import type { Party } from "#src/models/party.ts";
import { cn } from "@trizum/ui/utils";

export function PartySymbolBadge({ party, className }: { party: Party; className?: string }) {
  const symbol = party.symbol || party.name.charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-neutral-200 bg-neutral-950 text-lg font-semibold text-white dark:border-neutral-700/20 dark:bg-black/20 dark:text-neutral-50",
        className,
      )}
    >
      <span className="pt-0.5">{symbol}</span>
    </div>
  );
}
