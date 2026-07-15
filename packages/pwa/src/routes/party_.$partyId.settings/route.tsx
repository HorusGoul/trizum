import { Outlet, createFileRoute } from "@tanstack/react-router";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";
import { guardParticipatingInParty } from "#src/lib/guards.js";

export const Route = createFileRoute("/party_/$partyId/settings")({
  component: Outlet,
  pendingComponent: PartyPendingComponent,
  loader: async ({ context, params, location }) => {
    await guardParticipatingInParty(params.partyId, context, location);
  },
});
