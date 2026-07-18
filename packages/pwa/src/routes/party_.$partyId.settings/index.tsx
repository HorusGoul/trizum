import { Trans } from "@lingui/react/macro";
import { createFileRoute } from "@tanstack/react-router";
import { useParty } from "#src/hooks/useParty.js";
import { DEFAULT_PARTY_SYMBOL } from "#src/models/party.js";
import { Icon } from "#src/ui/Icon.js";
import { PartySettingsHeader } from "./-components/PartySettingsHeader.js";
import { PartySettingsLink } from "./-components/PartySettingsLink.js";
import { PartySettingsSection } from "./-components/PartySettingsSection.js";

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

        <PartySettingsSection icon="lucide.receipt-text" title={<Trans>Expenses</Trans>}>
          <PartySettingsLink
            to="/party/$partyId/settings/expense-templates"
            partyId={partyId}
            badge={
              <span className="bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-50 flex size-12 shrink-0 items-center justify-center rounded-full">
                <Icon icon="lucide.layout-template" width={22} height={22} />
              </span>
            }
            title={<Trans>Expense templates</Trans>}
            description={<Trans>Configure reusable defaults for new expenses</Trans>}
          />
        </PartySettingsSection>
      </main>
    </div>
  );
}
