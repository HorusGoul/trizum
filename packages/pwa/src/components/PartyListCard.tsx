import { Trans } from "@lingui/react/macro";
import type { AnyDocumentId } from "@automerge/automerge-repo/slim";
import { Link } from "react-aria-components";
import type { ReactNode } from "react";
import type { Party } from "#src/models/party.js";
import { useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.js";
import { IconWithFallback, type IconProps } from "#src/ui/Icon.js";
import { cn } from "#src/ui/utils.js";

interface PartyListCardProps {
  partyId: AnyDocumentId;
  isArchived?: boolean;
  isPinned?: boolean;
  lastUsedAt?: number | null;
  renderMenu?: (party: Party) => ReactNode;
}

export function PartyListCard({
  partyId,
  isArchived = false,
  isPinned = false,
  lastUsedAt = null,
  renderMenu,
}: PartyListCardProps) {
  const [party, handle] = useSuspenseDocument<Party>(partyId);

  if (!party || !handle) {
    return null;
  }

  const activeParticipants = Object.values(party.participants).filter(
    (participant) => !participant.isArchived,
  );
  const participantCount = activeParticipants.length;
  const symbolOrFirstLetter =
    party.symbol || party.name.charAt(0).toUpperCase();
  const description = party.description.trim();
  const formattedLastUsedAt =
    lastUsedAt && Number.isFinite(lastUsedAt)
      ? formatLastUsedAt(lastUsedAt)
      : null;

  return (
    <div
      data-testid="party-list-card"
      className="rounded-[1.75rem] border border-accent-200/80 bg-gradient-to-br from-white via-white to-accent-50/80 shadow-sm dark:border-accent-800 dark:from-accent-950 dark:via-accent-950 dark:to-accent-900/70 dark:shadow-none"
    >
      <div className="flex items-start gap-2 p-2">
        <Link
          href={{
            to: "/party/$partyId",
            params: {
              partyId: party.id,
            },
          }}
          className={({
            isPressed,
            isFocusVisible,
            isHovered,
            defaultClassName,
          }) =>
            cn(
              defaultClassName,
              "flex min-w-0 flex-1 scale-100 items-start gap-4 rounded-[1.45rem] p-3 text-start outline-none transition-all duration-200 ease-in-out",
              (isHovered || isFocusVisible) &&
                "bg-white/80 shadow-sm dark:bg-accent-900/60 dark:shadow-none",
              isPressed && "scale-[0.98] bg-white/70 dark:bg-accent-900/80",
            )
          }
        >
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[1.15rem] bg-accent-950 text-xl font-semibold text-white shadow-sm dark:bg-accent-100 dark:text-accent-950 dark:shadow-none">
            <span className="pt-0.5">{symbolOrFirstLetter}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="min-w-0">
              <span className="block truncate text-lg font-semibold tracking-tight text-accent-950 dark:text-accent-50">
                {party.name}
              </span>

              {description ? (
                <p className="mt-1 text-sm leading-6 text-accent-700 dark:text-accent-300">
                  {description}
                </p>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-accent-700 dark:text-accent-300">
              <PartyMetaChip>
                {participantCount}{" "}
                {participantCount === 1 ? (
                  <Trans>participant</Trans>
                ) : (
                  <Trans>participants</Trans>
                )}
              </PartyMetaChip>

              {isPinned ? (
                <PartyMetaChip icon="#lucide/pin">
                  <Trans>Pinned</Trans>
                </PartyMetaChip>
              ) : null}

              {isArchived ? (
                <PartyMetaChip icon="#lucide/archive">
                  <Trans>Archived</Trans>
                </PartyMetaChip>
              ) : null}

              {formattedLastUsedAt ? (
                <PartyMetaChip icon="#lucide/history">
                  <Trans>Last used</Trans> {formattedLastUsedAt}
                </PartyMetaChip>
              ) : null}
            </div>
          </div>
        </Link>

        {renderMenu ? <div className="pt-1">{renderMenu(party)}</div> : null}
      </div>
    </div>
  );
}

function PartyMetaChip({
  children,
  icon,
}: {
  children: ReactNode;
  icon?: IconProps["name"];
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-700 dark:bg-accent-800 dark:text-accent-200">
      {icon ? <IconWithFallback name={icon} size={12} /> : null}
      <span>{children}</span>
    </span>
  );
}

function formatLastUsedAt(lastUsedAt: number) {
  const date = new Date(lastUsedAt);
  const now = new Date();
  const includeYear = date.getFullYear() !== now.getFullYear();

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(date);
}
