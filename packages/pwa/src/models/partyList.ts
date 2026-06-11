import type { SupportedLocale } from "#src/lib/i18n.js";
import type { Party, PartyParticipant } from "./party";

export interface PartyList {
  id: string;
  type: "partyList";
  username: string;
  phone: string;
  avatarId?: string | null;
  locale?: SupportedLocale;
  openLastPartyOnLaunch?: boolean;
  autoOpenCalculator?: boolean;
  hue?: number;
  lastOpenedPartyId?: string | null;
  parties: Record<Party["id"], true | undefined>;
  pinnedParties?: Record<Party["id"], true | undefined>;
  archivedParties?: Record<Party["id"], true | undefined>;
  lastUsedAt?: Record<Party["id"], number | undefined>;
  participantInParties: Record<Party["id"], PartyParticipant["id"]>;
}
