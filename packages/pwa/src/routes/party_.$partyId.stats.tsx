import { Trans } from "@lingui/react/macro";
import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { BackButton } from "#src/components/BackButton.tsx";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";
import { PartyStatsView } from "#src/components/PartyStatsView.tsx";
import { documentCache } from "#src/lib/automerge/suspense-hooks.js";
import { guardParticipatingInParty } from "#src/lib/guards.js";

export const Route = createFileRoute("/party_/$partyId/stats")({
  component: PartyStatsRoute,
  pendingComponent: PartyPendingComponent,
  loader: async ({ context, params: { partyId }, location }) => {
    const { party } = await guardParticipatingInParty(
      partyId,
      context,
      location,
    );

    for (const chunkRef of party.chunkRefs) {
      await documentCache.readAsync(context.repo, chunkRef.chunkId);
    }

    return;
  },
});

function PartyStatsRoute() {
  const { partyId } = Route.useParams();
  const scrollElementRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollElementRef}
      className="flex h-[100dvh] max-h-[100dvh] min-h-0 touch-pan-y flex-col overflow-y-auto overscroll-y-contain"
    >
      <div className="container flex h-16 flex-shrink-0 items-center px-2 mt-safe">
        <BackButton
          fallbackOptions={{
            to: "/party/$partyId",
            params: { partyId },
          }}
        />

        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>Party stats</Trans>
        </h1>
      </div>

      <PartyStatsView scrollElementRef={scrollElementRef} />
    </div>
  );
}
