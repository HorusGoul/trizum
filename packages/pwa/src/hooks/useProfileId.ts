import { view } from "@nkzw/fate";
import { useFateClient, useView } from "react-fate";
import type { SessionEntity } from "#src/lib/data/entities.ts";

const ProfileSessionView = view<SessionEntity>()({ profileId: true });

export function useProfileId() {
  const client = useFateClient();

  const session = useView(
    ProfileSessionView,
    client.ref<SessionEntity>("Session", "current", ProfileSessionView),
  );

  return session.profileId;
}
