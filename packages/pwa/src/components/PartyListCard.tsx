import { Plural, Trans } from "@lingui/react/macro";
import type { AnyDocumentId } from "@automerge/automerge-repo/slim";
import { useNavigate } from "@tanstack/react-router";
import {
  mergeProps,
  useFocusRing,
  useFocusWithin,
  useHover,
  usePress,
} from "react-aria";
import { Link } from "react-aria-components";
import { type ReactNode, useState } from "react";
import type { Party, PartyParticipant } from "#src/models/party.js";
import { useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.js";
import { IconWithFallback } from "#src/ui/Icon.js";
import { cn } from "#src/ui/utils.js";

interface PartyListCardProps {
  partyId: AnyDocumentId;
  isArchived?: boolean;
  isPinned?: boolean;
  currentParticipantId?: PartyParticipant["id"] | null;
  renderMenu?: (party: Party) => ReactNode;
}

export function PartyListCard({
  partyId,
  isArchived = false,
  isPinned = false,
  currentParticipantId = null,
  renderMenu,
}: PartyListCardProps) {
  const navigate = useNavigate();
  const [party, handle] = useSuspenseDocument<Party>(partyId);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const { hoverProps, isHovered } = useHover({});
  const { focusProps, isFocusVisible } = useFocusRing({
    within: true,
  });
  const { focusWithinProps } = useFocusWithin({
    onFocusWithinChange: setIsFocusWithin,
  });
  const { pressProps, isPressed } = usePress({
    onPress: () => {
      if (!party) {
        return;
      }

      void navigate({
        to: "/party/$partyId",
        params: {
          partyId: party.id,
        },
        search: {
          tab: "expenses",
        },
      });
    },
  });

  if (!party || !handle) {
    return null;
  }

  const symbolOrFirstLetter =
    party.symbol || party.name.charAt(0).toUpperCase();
  const description = party.description.trim();
  const participantPreview = getParticipantPreview(party, currentParticipantId);
  const hasDescription = description.length > 0;
  const hasSupportingCopy = hasDescription || participantPreview !== null;
  const partyRouteParams = {
    partyId: party.id,
  };
  const statusBadge = isArchived
    ? {
        icon: "#lucide/archive" as const,
        label: <Trans>Archived</Trans>,
      }
    : isPinned
      ? {
          icon: "#lucide/pin" as const,
          label: <Trans>Pinned</Trans>,
        }
      : null;

  return (
    <div
      data-testid="party-list-card"
      {...mergeProps(hoverProps, focusProps, focusWithinProps)}
      className={cn(
        "relative cursor-pointer rounded-xl border border-accent-200/80 bg-gradient-to-br from-white via-white to-accent-50/80 shadow-sm transition-all duration-200 ease-in-out has-[>[data-party-card-surface][data-pressed]]:scale-[0.99] dark:border-accent-800 dark:from-accent-950 dark:via-accent-950 dark:to-accent-900/70 dark:shadow-none",
        isHovered &&
          "border-accent-300/90 shadow-md dark:border-accent-700 dark:shadow-none",
        isFocusWithin && "shadow-md dark:shadow-none",
        isFocusVisible &&
          "border-accent-500 dark:border-accent-500 dark:shadow-none",
        isPressed && "scale-[0.96]",
      )}
    >
      <div
        data-party-card-surface=""
        aria-hidden="true"
        {...pressProps}
        className="absolute inset-0 rounded-xl"
      />

      <div
        className={cn(
          "pointer-events-none relative flex gap-4 p-4",
          hasSupportingCopy ? "items-start" : "items-center",
        )}
      >
        <div className="relative mt-1 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border bg-accent-950 text-xl font-semibold text-white shadow-sm dark:border-accent-700/20 dark:bg-black/20 dark:text-accent-50 dark:shadow-none">
          <span className="pt-0.5">{symbolOrFirstLetter}</span>

          {statusBadge ? (
            <span className="absolute -bottom-0.5 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-accent-200 bg-white text-accent-700 shadow-sm dark:border-accent-700 dark:bg-accent-950 dark:text-accent-200">
              <IconWithFallback name={statusBadge.icon} size={11} />
              <span className="sr-only">{statusBadge.label}</span>
            </span>
          ) : null}
        </div>

        <div
          className={cn(
            "min-w-0 flex-1",
            hasSupportingCopy ? undefined : "flex min-h-14 items-center",
          )}
        >
          <Link
            data-party-card-interactive=""
            href={{
              to: "/party/$partyId",
              params: partyRouteParams,
            }}
            onContextMenu={(event) => {
              event.preventDefault();
            }}
            style={{ WebkitTouchCallout: "none" }}
            className={({ defaultClassName }) =>
              cn(
                defaultClassName,
                "pointer-events-auto inline-flex max-w-full rounded-sm text-start outline-none transition-colors duration-200 ease-in-out",
              )
            }
          >
            <span className="line-clamp-2 block text-lg font-semibold tracking-tight text-accent-950 sm:line-clamp-1 dark:text-accent-50">
              {party.name}
            </span>
          </Link>

          {participantPreview ? (
            <p className="mt-1 flex min-w-0 items-start gap-2 text-sm leading-6 text-accent-900/80 dark:text-accent-200">
              <IconWithFallback
                name="#lucide/users"
                size={16}
                aria-hidden="true"
                className="mt-1 flex-shrink-0 opacity-90"
              />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block sm:hidden">
                  <ParticipantPreviewText preview={participantPreview.mobile} />
                </span>
                <span className="line-clamp-1 hidden sm:block">
                  <ParticipantPreviewText
                    preview={participantPreview.desktop}
                  />
                </span>
              </span>
            </p>
          ) : null}

          {hasDescription ? (
            <p className="mt-1 text-sm italic leading-6 text-accent-900 dark:text-accent-100/80">
              {description}
            </p>
          ) : null}
        </div>

        {renderMenu ? (
          <div
            data-party-card-interactive=""
            className={cn(
              "pointer-events-auto",
              hasDescription ? "pt-0.5" : undefined,
            )}
          >
            {renderMenu(party)}
          </div>
        ) : null}
      </div>
    </div>
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
          <Plural
            value={preview.remainingCount}
            one="and # other"
            other="and # others"
          />
        </>
      ) : null}
    </>
  );
}

function getParticipantPreview(
  party: Party,
  currentParticipantId: PartyParticipant["id"] | null,
) {
  const visibleParticipantNames = Object.values(party.participants)
    .filter(
      (participant) =>
        !participant.isArchived &&
        participant.id !== currentParticipantId &&
        participant.name.trim() !== "",
    )
    .map((participant) => participant.name.trim());

  if (visibleParticipantNames.length === 0) {
    return null;
  }

  return {
    mobile: getParticipantPreviewVariant(visibleParticipantNames, 2),
    desktop: getParticipantPreviewVariant(visibleParticipantNames, 3),
  };
}

function getParticipantPreviewVariant(
  visibleParticipantNames: string[],
  maxNames: number,
) {
  const previewNames = visibleParticipantNames.slice(0, maxNames);

  return {
    names: previewNames.join(", "),
    remainingCount: visibleParticipantNames.length - previewNames.length,
  };
}
