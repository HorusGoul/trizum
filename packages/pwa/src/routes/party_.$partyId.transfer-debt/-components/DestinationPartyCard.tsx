import { Plural } from "@lingui/react/macro";
import type { PartyParticipant } from "#src/models/party.ts";
import { Icon } from "@trizum/ui/Icon";
import { cn } from "@trizum/ui/utils";
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
        "shadow-surface w-full rounded-3xl bg-white p-5 text-left transition-all duration-200 ease-in-out dark:bg-neutral-900",
        "active:scale-[0.99] hover:bg-neutral-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500 dark:hover:bg-neutral-800 dark:focus-visible:ring-accent-400",
      )}
      onClick={onPress}
    >
      <div className={cn("flex gap-4", hasSupportingCopy ? "items-start" : "items-center")}>
        <PartySymbolBadge party={option.entry.party} className="mt-1 h-12 w-12 text-xl" />

        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
            {option.entry.party.name}
          </div>
          {participantPreview ? (
            <p className="mt-1 flex min-w-0 items-start gap-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              <Icon
                icon="lucide.users"
                width={16}
                height={16}
                aria-hidden="true"
                className="mt-1 shrink-0 opacity-90"
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
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-neutral-600 italic dark:text-neutral-400">
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
