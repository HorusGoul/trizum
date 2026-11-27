import { t } from "@lingui/core/macro";
import type { PartyParticipant } from "#src/models/party.ts";
import { Icon } from "@trizum/ui/Icon";
import { cn } from "@trizum/ui/utils";
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
        "hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-500/30 dark:hover:bg-neutral-950 dark:focus-visible:bg-neutral-950",
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
            className="absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-neutral-500 text-neutral-50 shadow-xs dark:border-neutral-900 dark:bg-neutral-400 dark:text-neutral-950"
          >
            <Icon icon="lucide.sparkles" width={9} height={9} />
          </span>
        ) : null}
      </div>

      <span className="min-w-0 flex-1 truncate text-base font-medium text-neutral-950 dark:text-neutral-50">
        {participant.name}
      </span>
    </button>
  );
}
