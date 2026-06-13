import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { createFileRoute } from "@tanstack/react-router";
import type { Currency } from "dinero.js";
import { BackButton } from "#src/components/BackButton.tsx";
import { CurrencyText } from "#src/components/CurrencyText.tsx";
import { useCurrentParty, useParty } from "#src/hooks/useParty.ts";
import { documentCache, useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.ts";
import { guardParticipatingInParty } from "#src/lib/guards.ts";
import { ensurePartyActivityLog } from "#src/models/partyActivity.ts";
import type {
  Party,
  PartyActivityLog,
  PartyActivityLogEntry,
  PartyActivityParticipantChange,
  PartyActivitySettingsChange,
} from "#src/models/party.ts";
import { Icon } from "#src/ui/Icon.tsx";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";

export const Route = createFileRoute("/party_/$partyId/log")({
  component: PartyLogRoute,
  pendingComponent: PartyPendingComponent,
  loader: async ({ context, params: { partyId }, location }) => {
    const { party } = await guardParticipatingInParty(partyId, context, location);
    const partyHandle = await context.repo.find<Party>(party.id);
    const activityLogHandle = await ensurePartyActivityLog(context.repo, partyHandle);

    await documentCache.readAsync(context.repo, activityLogHandle.documentId);
  },
});

function PartyLogRoute() {
  const { partyId } = Route.useParams();
  const { party } = useParty(partyId);
  const activityLogId = party.activityLogId;

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col">
      <div className="container flex h-16 flex-shrink-0 items-center px-2 mt-safe">
        <BackButton
          fallbackOptions={{
            to: "/party/$partyId",
            params: { partyId },
          }}
        />

        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>Log</Trans>
        </h1>
      </div>

      {activityLogId ? <PartyActivityLogDocument activityLogId={activityLogId} /> : null}
    </div>
  );
}

function PartyActivityLogDocument({ activityLogId }: { activityLogId: PartyActivityLog["id"] }) {
  const { party } = useCurrentParty();
  const { i18n } = useLingui();
  const [activityLog] = useSuspenseDocument<PartyActivityLog>(activityLogId, {
    required: true,
  });
  const entries = activityLog.entries;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="container flex flex-col gap-3 px-2 py-4">
        {entries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-accent-300 p-6 text-center dark:border-accent-700">
            <Icon icon="lucide.history" className="mx-auto mb-3 text-accent-500" />
            <p className="font-medium">
              <Trans>No log entries yet</Trans>
            </p>
            <p className="mt-2 text-sm text-accent-700 dark:text-accent-300">
              <Trans>Changes made from now on will show up here.</Trans>
            </p>
          </div>
        ) : (
          entries.map((entry) => (
            <ActivityLogItem
              key={entry.id}
              currency={party.currency}
              entry={entry}
              locale={i18n.locale}
            />
          ))
        )}
      </div>

      <div className="h-8 flex-shrink-0" />
    </div>
  );
}

function ActivityLogItem({
  currency,
  entry,
  locale,
}: {
  currency: Currency;
  entry: PartyActivityLogEntry;
  locale: string;
}) {
  const icon = getActivityLogIcon(entry);
  const createdAt = new Date(entry.createdAt);

  return (
    <article className="rounded-lg bg-white p-4 text-start dark:bg-accent-900">
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700 dark:bg-accent-800 dark:text-accent-200">
          <Icon icon={icon} width={18} height={18} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-accent-950 dark:text-accent-50">
            <ActivityLogTitle entry={entry} />
          </h3>

          <p className="mt-1 text-sm text-accent-700 dark:text-accent-300">
            {createdAt.toLocaleString(locale)}
          </p>

          <ActivityLogDetails entry={entry} currency={currency} />
        </div>
      </div>
    </article>
  );
}

function ActivityLogTitle({ entry }: { entry: PartyActivityLogEntry }) {
  const participantName = "participantName" in entry ? entry.participantName : "";

  switch (entry.type) {
    case "party-created":
      return <Trans>Party created</Trans>;
    case "party-settings-updated":
      return <Trans>Party settings updated</Trans>;
    case "participant-added":
      return <Trans>{participantName} was added</Trans>;
    case "participant-updated":
      return <Trans>{participantName} was updated</Trans>;
    case "participant-archived":
      return <Trans>{participantName} was archived</Trans>;
    case "participant-restored":
      return <Trans>{participantName} was restored</Trans>;
    case "participant-removed":
      return <Trans>{participantName} was removed</Trans>;
    case "expense-added":
      return <Trans>Expense added</Trans>;
    case "expense-updated":
      return <Trans>Expense updated</Trans>;
    case "expense-removed":
      return <Trans>Expense deleted</Trans>;
    case "debt-transferred":
      return <Trans>Debt transferred</Trans>;
  }
}

function ActivityLogDetails({
  currency,
  entry,
}: {
  currency: Currency;
  entry: PartyActivityLogEntry;
}) {
  const partyName = "partyName" in entry ? entry.partyName : "";

  switch (entry.type) {
    case "party-created":
      return (
        <p className="mt-2 text-sm">
          <Trans>{partyName} started tracking shared expenses.</Trans>
        </p>
      );
    case "party-settings-updated":
      return <ActivityLogChangeList changes={entry.changes.map(getSettingsChangeLabel)} />;
    case "participant-updated":
      return <ActivityLogChangeList changes={entry.changes.map(getParticipantChangeLabel)} />;
    case "expense-added":
    case "expense-updated":
    case "expense-removed":
      return (
        <p className="mt-2 text-sm">
          <span className="font-medium">{entry.expenseName}</span>
          {" - "}
          <CurrencyText amount={entry.amount} currency={currency} />
        </p>
      );
    case "debt-transferred":
      return (
        <p className="mt-2 text-sm">
          <span className="font-medium">{entry.originExpenseName}</span>
          {" - "}
          <CurrencyText amount={entry.amount} currency={currency} />
        </p>
      );
    case "participant-added":
    case "participant-archived":
    case "participant-restored":
    case "participant-removed":
      return null;
  }
}

function ActivityLogChangeList({ changes }: { changes: string[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-2 text-sm">
      {changes.map((change) => (
        <li key={change} className="rounded-md bg-accent-100 px-2 py-1 dark:bg-accent-800">
          {change}
        </li>
      ))}
    </ul>
  );
}

function getSettingsChangeLabel(change: PartyActivitySettingsChange) {
  switch (change) {
    case "name":
      return t`Name`;
    case "symbol":
      return t`Symbol`;
    case "description":
      return t`Description`;
  }
}

function getParticipantChangeLabel(change: PartyActivityParticipantChange) {
  switch (change) {
    case "name":
      return t`Name`;
    case "phone":
      return t`Phone`;
    case "avatar":
      return t`Avatar`;
  }
}

function getActivityLogIcon(entry: PartyActivityLogEntry) {
  switch (entry.type) {
    case "party-created":
      return "lucide.sparkles";
    case "party-settings-updated":
      return "lucide.settings";
    case "participant-added":
      return "lucide.user-plus";
    case "participant-updated":
      return "lucide.user-round-pen";
    case "participant-archived":
      return "lucide.archive";
    case "participant-restored":
      return "lucide.archive-restore";
    case "participant-removed":
      return "lucide.user-minus";
    case "expense-added":
      return "lucide.list-plus";
    case "expense-updated":
      return "lucide.pencil";
    case "expense-removed":
      return "lucide.trash";
    case "debt-transferred":
      return "lucide.corner-down-right";
  }
}
