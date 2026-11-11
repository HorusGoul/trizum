import { useProfileId } from "#src/hooks/useProfileId.ts";
import type { ProfileEntity, PartyEntity } from "#src/lib/data/entities.ts";
import { requireAvailable } from "#src/lib/data/availability.ts";
import { useFateClient, useView } from "react-fate";
import { PartyCardView } from "#src/components/PartyListCard.view.ts";
import { mutationResult } from "#src/lib/data/mutationResult.ts";
import { view } from "@nkzw/fate";
import { trackEvent } from "#src/lib/analytics.ts";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "react-aria-components";
import { toast } from "sonner";
import { BackButton } from "#src/components/BackButton.js";
import { PartyListCard } from "#src/components/PartyListCard.tsx";
import type { PartyListCardAction } from "#src/components/PartyListCard.tsx";
import { getOrderedPartySections } from "#src/lib/partyListOrdering.ts";
import type { OrderedProfile } from "#src/lib/partyListOrdering.ts";
import { Icon } from "@trizum/ui/Icon";
import { cn } from "@trizum/ui/utils";

const PartyPrefetchView = view<PartyEntity>()({ id: true, available: true });

const ProfileHomeView = view<ProfileEntity>()({
  id: true,
  available: true,
  parties: true,
  pinnedParties: true,
  archivedParties: true,
  lastUsedAt: true,
  lastOpenedPartyId: true,
  participantInParties: true,
});

export const Route = createFileRoute("/archived")({
  component: ArchivedParties,
});

function ArchivedParties() {
  const profileId = useProfileId();

  const client = useFateClient();

  const partyList = requireAvailable(
    useView(ProfileHomeView, client.ref<ProfileEntity>("Profile", profileId, ProfileHomeView)),
  );

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
                onAction: async () => {
                  await mutationResult(
                    client.mutations.profile.setPartyArchived({
                      input: { profileId: partyList.id, parameters: [partyId, false] },
                    }),
                  );
                  trackEvent("party_restored");
                  toast.success(t`Party restored to home`);
                },
              },
            ];

            return (
              <PartyListCard
                actions={actions}
                key={partyId}
                partyRef={client.ref<PartyEntity>("Party", partyId, PartyCardView)}
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

function useArchivedPartyIds(partyList: OrderedProfile) {
  const client = useFateClient();
  const { archivedPartyIds } = getOrderedPartySections(partyList);

  for (const partyId of archivedPartyIds) {
    void client.readView(
      PartyPrefetchView,
      client.ref<PartyEntity>("Party", partyId, PartyPrefetchView),
    );
  }

  return archivedPartyIds;
}

function ArchivedEmptyState() {
  return (
    <div className="border-accent-300 dark:border-accent-700 dark:bg-accent-950/70 rounded-xl border border-dashed bg-white/80 p-6 text-center shadow-xs dark:shadow-none">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4">
        <div className="bg-accent-100 text-accent-700 dark:bg-accent-800 dark:text-accent-200 rounded-full p-4">
          <Icon icon="lucide.archive-restore" width={22} height={22} />
        </div>
        <div>
          <h2 className="text-accent-950 dark:text-accent-50 text-xl font-semibold">
            <Trans>No archived parties</Trans>
          </h2>
          <p className="text-accent-700 dark:text-accent-300 mt-2 text-sm">
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
              "inline-flex items-center justify-center rounded-full bg-accent-500 px-4 py-2.5 text-sm font-semibold text-accent-50 outline-hidden transition-all duration-200 ease-in-out dark:bg-accent-500",
              (isHovered || isFocusVisible) && "bg-accent-600 dark:bg-accent-400",
              isPressed && "scale-95 bg-accent-700 dark:bg-accent-300",
            )
          }
        >
          <Trans>Back to home</Trans>
        </Link>
      </div>
    </div>
  );
}
