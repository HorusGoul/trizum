import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Icon } from "@trizum/ui/Icon";

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
      className="-mx-3 flex min-h-20 w-[calc(100%+1.5rem)] scale-100 items-center gap-3 rounded-xl px-3 py-3 text-left outline-hidden transition-all duration-200 ease-in-out hover:bg-neutral-100/70 focus-visible:bg-neutral-100/70 focus-visible:ring-2 focus-visible:ring-neutral-500 active:scale-[0.98] dark:hover:bg-neutral-900/70 dark:focus-visible:bg-neutral-900/70 dark:focus-visible:ring-neutral-400"
    >
      {badge}

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="leading-tight font-medium">{title}</span>
        <span className="text-sm leading-snug text-neutral-700 dark:text-neutral-200">
          {description}
        </span>
      </span>

      <Icon
        icon="lucide.chevron-right"
        width={18}
        height={18}
        className="ml-2 shrink-0 text-neutral-700 dark:text-neutral-100"
      />
    </Link>
  );
}
