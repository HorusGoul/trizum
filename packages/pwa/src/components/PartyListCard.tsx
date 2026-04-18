import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import type { AnyDocumentId } from "@automerge/automerge-repo/slim";
import { useNavigate } from "@tanstack/react-router";
import {
  mergeProps,
  useFocusRing,
  useFocusWithin,
  useHover,
  useLongPress,
  usePress,
} from "react-aria";
import { Link, MenuTrigger, Popover } from "react-aria-components";
import { type ComponentProps, type ReactNode, useState } from "react";
import { useMediaQuery } from "#src/hooks/useMediaQuery.js";
import type { Party, PartyParticipant } from "#src/models/party.js";
import { useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.js";
import { IconWithFallback } from "#src/ui/Icon.js";
import { IconButton } from "#src/ui/IconButton.js";
import { Menu, MenuItem } from "#src/ui/Menu.js";
import {
  ModalSheet,
  ModalSheetAction,
  type ModalSheetActionTone,
  ModalSheetActions,
  ModalSheetContent,
  ModalSheetHeader,
  ModalSheetSection,
  ModalSheetTitle,
} from "#src/ui/ModalSheet.js";
import { cn } from "#src/ui/utils.js";

export interface PartyListCardAction {
  key: string;
  icon: ComponentProps<typeof IconWithFallback>["icon"];
  label: ReactNode;
  onAction: () => void;
  tone?: ModalSheetActionTone;
}

interface PartyListCardProps {
  actions?: PartyListCardAction[];
  partyId: AnyDocumentId;
  isArchived?: boolean;
  isPinned?: boolean;
  currentParticipantId?: PartyParticipant["id"] | null;
}

export function PartyListCard({
  actions = [],
  partyId,
  isArchived = false,
  isPinned = false,
  currentParticipantId = null,
}: PartyListCardProps) {
  const navigate = useNavigate();
  const isLargeScreen = useMediaQuery("(min-width: 768px)");
  const [party, handle] = useSuspenseDocument<Party>(partyId);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(false);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
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
  const hasActions = actions.length > 0;
  const { longPressProps } = useLongPress({
    isDisabled: !hasActions || isLargeScreen,
    accessibilityDescription: t`Long press for party actions`,
    onLongPress: () => {
      if (!party || !hasActions) {
        return;
      }

      setIsMobileSheetOpen(true);
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
  const showDesktopActionButton =
    hasActions &&
    isLargeScreen &&
    (isHovered || isFocusWithin || isDesktopMenuOpen);
  const partyRouteParams = {
    partyId: party.id,
  };
  const statusBadge = isArchived
    ? {
        icon: "lucide.archive" as const,
        label: <Trans>Archived</Trans>,
      }
    : isPinned
      ? {
          icon: "lucide.pin" as const,
          label: <Trans>Pinned</Trans>,
        }
      : null;
  const suppressNativeLongPress = {
    WebkitTouchCallout: "none",
    WebkitUserSelect: "none",
    userSelect: "none",
  } as const;

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
        {...mergeProps(pressProps, longPressProps)}
        onContextMenu={(event) => {
          event.preventDefault();
        }}
        style={suppressNativeLongPress}
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
              <IconWithFallback
                icon={statusBadge.icon}
                width={11}
                height={11}
              />
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
            style={suppressNativeLongPress}
            className={({ defaultClassName }) =>
              cn(
                defaultClassName,
                "inline-flex max-w-full rounded-sm text-start outline-none transition-colors duration-200 ease-in-out",
                isLargeScreen ? "pointer-events-auto" : "pointer-events-none",
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

        {hasActions && isLargeScreen ? (
          <div
            data-party-card-interactive=""
            className={cn(
              "pointer-events-auto w-10 flex-shrink-0",
              hasDescription ? "pt-0.5" : undefined,
            )}
          >
            {showDesktopActionButton ? (
              <MenuTrigger
                isOpen={isDesktopMenuOpen}
                onOpenChange={setIsDesktopMenuOpen}
              >
                <IconButton
                  icon="lucide.ellipsis-vertical"
                  aria-label={t`Party actions`}
                  color="transparent"
                  className={cn(
                    "h-10 w-10 flex-shrink-0",
                    isDesktopMenuOpen &&
                      "bg-accent-950 bg-opacity-5 dark:bg-accent-50 dark:bg-opacity-5",
                  )}
                />

                <Popover placement="bottom end">
                  <Menu className="min-w-60">
                    {actions.map((action) => (
                      <MenuItem
                        key={action.key}
                        onAction={() => {
                          setIsDesktopMenuOpen(false);
                          action.onAction();
                        }}
                      >
                        <IconWithFallback
                          icon={action.icon}
                          width={20}
                          height={20}
                          className="mr-3"
                        />
                        <span
                          className={cn(
                            "h-3.5 leading-none",
                            action.tone === "danger" &&
                              "text-rose-700 dark:text-rose-300",
                          )}
                        >
                          {action.label}
                        </span>
                      </MenuItem>
                    ))}
                  </Menu>
                </Popover>
              </MenuTrigger>
            ) : null}
          </div>
        ) : null}
      </div>

      {hasActions ? (
        <ModalSheet
          isOpen={isMobileSheetOpen && !isLargeScreen}
          onOpenChange={setIsMobileSheetOpen}
        >
          <ModalSheetHeader>
            <ModalSheetSection>
              <ModalSheetTitle className="line-clamp-2">
                {party.name}
              </ModalSheetTitle>
            </ModalSheetSection>
          </ModalSheetHeader>

          <ModalSheetContent>
            <ModalSheetActions>
              {actions.map((action) => (
                <ModalSheetAction
                  key={action.key}
                  icon={action.icon}
                  tone={action.tone}
                  onPress={() => {
                    setIsMobileSheetOpen(false);
                    action.onAction();
                  }}
                >
                  {action.label}
                </ModalSheetAction>
              ))}
            </ModalSheetActions>
          </ModalSheetContent>
        </ModalSheet>
      ) : null}
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
