import { view } from "@nkzw/fate";
import type { PartyEntity } from "#src/lib/data/entities.ts";

export const PartyCardView = view<PartyEntity>()({
  id: true,
  available: true,
  name: true,
  symbol: true,
  description: true,
  participants: true,
});
