import { Trans } from "@lingui/react/macro";
import { Link, createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useParty } from "#src/hooks/useParty.js";
import { DEFAULT_PARTY_SYMBOL } from "#src/models/party.js";
import { Icon, type IconProps } from "#src/ui/Icon.js";
import { PartySettingsHeader } from "./-components/PartySettingsHeader.js";

export const Route = createFileRoute("/party_/$partyId/settings/")({
  component: PartySettings,
});

function PartySettings() {
  const { partyId } = Route.useParams();
  const { party } = useParty(partyId);

  return (
    <div className="flex min-h-full flex-col">
      <PartySettingsHeader title={<Trans>Party Settings</Trans>} />

      <main className="container mt-4 flex flex-col gap-6 px-4">
        <PartySettingsSection icon="lucide.badge-info" title={<Trans>Party</Trans>}>
          <PartySettingsLink
            to="/party/$partyId/settings/details"
            partyId={partyId}
            badge={
              <span className="bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-50 flex size-12 shrink-0 items-center justify-center rounded-full text-xl">
                {party.symbol || DEFAULT_PARTY_SYMBOL}
              </span>
            }
            title={party.name}
            description={<Trans>Party title, description and icon</Trans>}
          />
        </PartySettingsSection>

        <PartySettingsSection icon="lucide.users" title={<Trans>People</Trans>}>
          <PartySettingsLink
            to="/party/$partyId/settings/participants"
            partyId={partyId}
            badge={
              <span className="bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-50 flex size-12 shrink-0 items-center justify-center rounded-full">
                <Icon icon="lucide.user-cog" width={22} height={22} />
              </span>
            }
            title={<Trans>Participants</Trans>}
            description={<Trans>Add, edit, and archive participants</Trans>}
          />
        </PartySettingsSection>
      </main>
    </div>
  );
}

function PartySettingsSection({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: IconProps["icon"];
  title: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="text-accent-700 dark:text-accent-200 flex items-center gap-2 text-sm font-semibold">
        <Icon icon={icon} width={16} height={16} />
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function PartySettingsLink({
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
  to: "/party/$partyId/settings/details" | "/party/$partyId/settings/participants";
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
