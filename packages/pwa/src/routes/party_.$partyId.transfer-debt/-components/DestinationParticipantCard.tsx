import { t } from "@lingui/core/macro";
import type { PartyParticipant } from "#src/models/party.ts";
import { Icon } from "#src/ui/Icon.tsx";
import { cn } from "#src/ui/utils.ts";
import { TransferParticipantAvatar } from "./TransferParticipantAvatar.js";

export function DestinationParticipantCard({
  participant,
  isRecommended,
  onPress,
}: {
  participant: PartyParticipant;
  isRecommended: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-200",
        "hover:bg-accent-50 focus-visible:bg-accent-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500/30 dark:hover:bg-accent-950 dark:focus-visible:bg-accent-950",
      )}
      onClick={onPress}
    >
      <div className="relative shrink-0">
        <TransferParticipantAvatar
          participant={participant}
          className="h-9 w-9 text-xs shadow-xs"
        />
        {isRecommended ? (
          <span
            aria-label={t`Recommended match`}
            className="bg-accent-500 text-accent-50 dark:border-accent-900 dark:bg-accent-400 dark:text-accent-950 absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-white shadow-xs"
          >
            <Icon icon="lucide.sparkles" width={9} height={9} />
          </span>
        ) : null}
      </div>

      <span className="text-accent-950 dark:text-accent-50 min-w-0 flex-1 truncate text-base font-medium">
        {participant.name}
      </span>
    </button>
  );
}
