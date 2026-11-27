import type { Party } from "#src/models/party.ts";
import { cn } from "@trizum/ui/utils";

export function PartySymbolBadge({ party, className }: { party: Party; className?: string }) {
  const symbol = party.symbol || party.name.charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-neutral-100 text-lg font-semibold text-neutral-950 dark:bg-neutral-800 dark:text-neutral-50",
        className,
      )}
    >
      <span className="pt-0.5">{symbol}</span>
    </div>
  );
}
