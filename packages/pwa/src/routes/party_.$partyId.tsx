import {
  closeRepoById,
  findOrCreateRepoById,
} from "#src/lib/automerge/repo.ts";
import { RepoContext } from "#src/lib/automerge/RepoContext.ts";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/party_/$partyId")({
  component: RouteComponent,

  context(ctx) {
    const repo = findOrCreateRepoById(ctx.params.partyId);

    return {
      repo,
    };
  },

  onLeave(ctx) {
    const partyId = ctx.params.partyId;
    closeRepoById(partyId);
  },
});

function RouteComponent() {
  const { repo } = Route.useRouteContext();

  return (
    <RepoContext value={repo}>
      <Outlet />
    </RepoContext>
  );
}
