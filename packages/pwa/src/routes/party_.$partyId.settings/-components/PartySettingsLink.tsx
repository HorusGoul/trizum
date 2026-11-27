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
      className="shadow-surface focus-visible:ring-accent-500 dark:focus-visible:ring-accent-400 flex min-h-20 w-full scale-100 items-center gap-3 rounded-3xl bg-white px-4 py-3 text-left outline-hidden transition-all duration-200 ease-in-out hover:bg-neutral-50 focus-visible:ring-2 active:scale-[0.98] dark:bg-neutral-900 dark:hover:bg-neutral-800"
    >
      {badge}

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="leading-tight font-medium">{title}</span>
        <span className="text-sm leading-snug text-neutral-600 dark:text-neutral-400">
          {description}
        </span>
      </span>

      <Icon
        icon="lucide.chevron-right"
        width={18}
        height={18}
        className="ml-2 shrink-0 text-neutral-400 dark:text-neutral-500"
      />
    </Link>
  );
}
