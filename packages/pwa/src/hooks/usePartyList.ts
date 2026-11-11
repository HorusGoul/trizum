import { useSyncExternalStore } from "react";
import { useRequiredView } from "#src/lib/data/hooks.ts";
import { useAppData } from "#src/lib/data/useAppData.ts";
import type { View, Selection } from "@nkzw/fate";
import type { ProfileEntity } from "#src/lib/data/entities.ts";

export function usePartyList<const Selected extends Selection<ProfileEntity>>(
  selected: View<ProfileEntity, Selected>,
) {
  const data = useAppData();

  const id = useSyncExternalStore(
    data.subscribeToProfile,
    data.activeProfileId,
    data.activeProfileId,
  );

  const partyList = useRequiredView(
    selected,
    data.entityRef<ProfileEntity>("Profile", id, selected),
  );

  return { partyList, ...data.profileActions(id) };
}
