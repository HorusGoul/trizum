import { Plural } from "@lingui/react/macro";
import type { PartyParticipant } from "#src/models/party.ts";
import { Icon } from "#src/ui/Icon.tsx";
import { cn } from "#src/ui/utils.ts";
import { PartySymbolBadge } from "./PartySymbolBadge.js";
import type { DestinationPartyOption } from "./types.js";

export function DestinationPartyCard({
  option,
  onPress,
}: {
  option: DestinationPartyOption;
  onPress: () => void;
}) {
  const participantPreview = getParticipantPreview(option.otherParticipants);
  const description = option.entry.party.description.trim();
  const hasDescription = description.length > 0;
  const hasSupportingCopy = hasDescription || participantPreview !== null;

  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-xl border p-4 text-left shadow-sm transition-all duration-200 ease-in-out",
        "border-accent-200/80 bg-gradient-to-br from-white via-white to-accent-50/80 active:scale-[0.99] hover:border-accent-300/90 hover:shadow-md focus-visible:border-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/20 dark:border-accent-800 dark:from-accent-950 dark:via-accent-950 dark:to-accent-900/70 dark:shadow-none dark:hover:border-accent-700 dark:focus-visible:border-accent-500",
      )}
      onClick={onPress}
    >
      <div className={cn("flex gap-4", hasSupportingCopy ? "items-start" : "items-center")}>
        <PartySymbolBadge party={option.entry.party} className="mt-1 h-12 w-12 text-xl shadow-sm" />

        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold tracking-tight text-accent-950 dark:text-accent-50">
            {option.entry.party.name}
          </div>
          {participantPreview ? (
            <p className="mt-1 flex min-w-0 items-start gap-2 text-sm leading-6 text-accent-900/80 dark:text-accent-200">
              <Icon
                icon="lucide.users"
                width={16}
                height={16}
                aria-hidden="true"
                className="mt-1 flex-shrink-0 opacity-90"
              />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block sm:hidden">
                  <ParticipantPreviewText preview={participantPreview.mobile} />
                </span>
                <span className="line-clamp-1 hidden sm:block">
                  <ParticipantPreviewText preview={participantPreview.desktop} />
                </span>
              </span>
            </p>
          ) : null}
          {hasDescription ? (
            <p className="mt-1 line-clamp-2 text-sm italic leading-6 text-accent-900 dark:text-accent-100/80">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function ParticipantPreviewText({
  preview,
}: {
  preview: {
    names: string;
    remainingCount: number;
  };
}) {
  return (
    <>
      {preview.names}
      {preview.remainingCount > 0 ? (
        <>
          {" "}
          <Plural value={preview.remainingCount} one="and # other" other="and # others" />
        </>
      ) : null}
    </>
  );
}

function getParticipantPreview(participants: PartyParticipant[]) {
  const visibleParticipantNames = [];

  for (const participant of participants) {
    const participantName = participant.name.trim();
    if (!participant.isArchived && participantName !== "") {
      visibleParticipantNames.push(participantName);
    }
  }

  if (visibleParticipantNames.length === 0) {
    return null;
  }

  return {
    mobile: getParticipantPreviewVariant(visibleParticipantNames, 2),
    desktop: getParticipantPreviewVariant(visibleParticipantNames, 3),
  };
}

function getParticipantPreviewVariant(visibleParticipantNames: string[], maxNames: number) {
  const previewNames = visibleParticipantNames.slice(0, maxNames);

  return {
    names: previewNames.join(", "),
    remainingCount: visibleParticipantNames.length - previewNames.length,
  };
}
