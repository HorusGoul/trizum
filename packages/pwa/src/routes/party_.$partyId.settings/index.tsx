import { Plural, Trans } from "@lingui/react/macro";
import { Link, createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useParty } from "#src/hooks/useParty.js";
import { DEFAULT_PARTY_SYMBOL } from "#src/models/party.js";
import { Icon } from "#src/ui/Icon.js";
import { PartySettingsHeader } from "./-components/PartySettingsHeader.js";

export const Route = createFileRoute("/party_/$partyId/settings/")({
  component: PartySettings,
});

function PartySettings() {
  const { partyId } = Route.useParams();
  const { party } = useParty(partyId);
  const participants = Object.values(party.participants);
  const activeParticipantCount = participants.filter(
    (participant) => !participant.isArchived,
  ).length;
  const archivedParticipantCount = participants.length - activeParticipantCount;

  return (
    <div className="flex min-h-full flex-col">
      <PartySettingsHeader title={<Trans>Party Settings</Trans>} />

      <main className="container mt-4 flex flex-col gap-2 px-4">
        <PartySettingsLink
          to="/party/$partyId/settings/details"
          partyId={partyId}
          badge={
            <span className="bg-accent-950 dark:border-accent-700/20 dark:text-accent-50 flex size-12 shrink-0 items-center justify-center rounded-full text-xl text-white shadow-xs dark:border dark:bg-black/20 dark:shadow-none">
              {party.symbol || DEFAULT_PARTY_SYMBOL}
            </span>
          }
          title={<Trans>Party details</Trans>}
          description={
            <>
              <span>{party.name}</span>
              <span className="text-accent-600 dark:text-accent-300">
                <Trans>Name, icon and description</Trans>
              </span>
            </>
          }
        />

        <PartySettingsLink
          to="/party/$partyId/settings/participants"
          partyId={partyId}
          badge={
            <span className="bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-50 flex size-12 shrink-0 items-center justify-center rounded-full">
              <Icon icon="lucide.users" width={22} height={22} />
            </span>
          }
          title={<Trans>Participants</Trans>}
          description={
            <span className="flex flex-wrap items-center gap-x-1">
              <Plural value={activeParticipantCount} one="# active" other="# active" />
              <span aria-hidden="true">·</span>
              <Plural value={archivedParticipantCount} one="# archived" other="# archived" />
            </span>
          }
        />
      </main>
    </div>
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
        <span className="text-accent-700 dark:text-accent-200 flex flex-col text-sm leading-snug">
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
