import { useFateClient, useView } from "react-fate";
import { view, type View, type Selection } from "@nkzw/fate";
import { useRequiredView } from "#src/lib/data/hooks.ts";
import type { ProfileEntity, SessionEntity } from "#src/lib/data/entities.ts";

const ProfileSessionView = view<SessionEntity>()({ profileId: true });

export function usePartyList<const Selected extends Selection<ProfileEntity>>(
  selected: View<ProfileEntity, Selected>,
) {
  const client = useFateClient();

  const { profileId } = useView(
    ProfileSessionView,
    client.ref<SessionEntity>("Session", "current", ProfileSessionView),
  );

  const partyList = useRequiredView(
    selected,
    client.ref<ProfileEntity>("Profile", profileId, selected),
  );

  return { partyList };
}
