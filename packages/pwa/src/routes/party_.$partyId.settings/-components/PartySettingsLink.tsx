import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Icon } from "#src/ui/Icon.js";

export function PartySettingsLink({
  badge,
  description,
  partyId,
  title,
  to,
}: {
  badge: ReactNode;
  description: ReactNode;
  partyId: string;
  title: ReactNode;
  to:
    | "/party/$partyId/settings/details"
    | "/party/$partyId/settings/participants"
    | "/party/$partyId/settings/expense-templates";
}) {
  return (
    <Link
      to={to}
      params={{ partyId }}
      className="hover:bg-accent-100/70 focus-visible:bg-accent-100/70 focus-visible:ring-accent-500 dark:hover:bg-accent-900/70 dark:focus-visible:bg-accent-900/70 dark:focus-visible:ring-accent-400 -mx-3 flex min-h-20 w-[calc(100%+1.5rem)] scale-100 items-center gap-3 rounded-xl px-3 py-3 text-left outline-hidden transition-all duration-200 ease-in-out focus-visible:ring-2 active:scale-[0.98]"
    >
      {badge}

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="leading-tight font-medium">{title}</span>
        <span className="text-accent-700 dark:text-accent-200 text-sm leading-snug">
          {description}
        </span>
      </span>

      <Icon
        icon="lucide.chevron-right"
        width={18}
        height={18}
        className="text-accent-700 dark:text-accent-100 ml-2 shrink-0"
      />
    </Link>
  );
}
