import { useParams } from "@tanstack/react-router";

export function useCurrentPartyId() {
  const partyId = useParams({ strict: false, select: (params) => params.partyId });

  if (!partyId) throw new Error("No Party ID found in URL");

  return partyId;
}
