import { trackEvent } from "#src/lib/analytics.ts";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "react-aria-components";
import { toast } from "sonner";
import { BackButton } from "#src/components/BackButton.js";
import { PartyListCard, type PartyListCardAction } from "#src/components/PartyListCard.tsx";
import { usePartyList } from "#src/hooks/usePartyList.js";
import type { PartyList } from "#src/models/partyList.js";
import { documentCache } from "#src/lib/automerge/suspense-hooks.js";
import { getOrderedPartySections } from "#src/lib/partyListOrdering.ts";
import { useRepo } from "#src/lib/automerge/useRepo.ts";
import { Icon } from "@trizum/ui/Icon";
import { cn } from "@trizum/ui/utils";

export const Route = createFileRoute("/archived")({
  component: ArchivedParties,
});

function ArchivedParties() {
  const { partyList, setPartyArchived } = usePartyList();
  const archivedPartyIds = useArchivedPartyIds(partyList);

  return (
    <div className="flex min-h-full flex-col">
      <div className="mt-safe container flex h-16 items-center px-2">
        <BackButton fallbackOptions={{ to: "/" }} />

        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>Archived Parties</Trans>
        </h1>
      </div>

      <div className="pb-safe-offset-8 container mt-4 flex flex-1 flex-col gap-4 px-2">
        {archivedPartyIds.length > 0 ? (
          archivedPartyIds.map((partyId) => {
            const actions: PartyListCardAction[] = [
              {
                key: "restore",
                icon: "lucide.archive-restore",
                label: <Trans>Restore to home</Trans>,
                onAction: () => {
                  setPartyArchived(partyId, false);
                  trackEvent("party_restored");
                  toast.success(t`Party restored to home`);
                },
              },
            ];

            return (
              <PartyListCard
                actions={actions}
                key={partyId}
                partyId={partyId}
                isArchived={true}
                currentParticipantId={partyList.participantInParties[partyId] ?? null}
              />
            );
          })
        ) : (
          <ArchivedEmptyState />
        )}
      </div>
    </div>
  );
}

function useArchivedPartyIds(partyList: PartyList) {
  const repo = useRepo();
  const { archivedPartyIds } = getOrderedPartySections(partyList);

  for (const partyId of archivedPartyIds) {
    documentCache.prefetch(repo, partyId);
  }

  return archivedPartyIds;
}

function ArchivedEmptyState() {
  return (
    <div className="shadow-surface rounded-3xl bg-white p-6 text-center dark:bg-neutral-900">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4">
        <div className="rounded-full bg-neutral-100 p-4 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
          <Icon icon="lucide.archive-restore" width={22} height={22} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-neutral-950 dark:text-neutral-50">
            <Trans>No archived parties</Trans>
          </h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            <Trans>
              Archive a party from the home screen when you want to clear some space without losing
              it.
            </Trans>
          </p>
        </div>

        <Link
          href={{ to: "/" }}
          className={({ isPressed, isFocusVisible, isHovered, defaultClassName }) =>
            cn(
              defaultClassName,
              "inline-flex items-center justify-center rounded-full bg-neutral-950/5 px-4 py-2.5 text-sm font-semibold text-neutral-950 outline-hidden transition-all duration-200 ease-in-out dark:bg-white/10 dark:text-neutral-50",
              isHovered && "bg-neutral-950/10 dark:bg-white/15",
              isFocusVisible && "ring-2 ring-accent-500 dark:ring-accent-400",
              isPressed && "scale-95 bg-neutral-950/10 dark:bg-white/15",
            )
          }
        >
          <Trans>Back to home</Trans>
        </Link>
      </div>
    </div>
  );
}
