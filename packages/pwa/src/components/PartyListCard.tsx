import { Trans } from "@lingui/react/macro";
import type { AnyDocumentId } from "@automerge/automerge-repo/slim";
import { useNavigate } from "@tanstack/react-router";
import { Link } from "react-aria-components";
import type { ReactNode } from "react";
import type { Party } from "#src/models/party.js";
import { useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.js";
import { IconWithFallback } from "#src/ui/Icon.js";
import { cn } from "#src/ui/utils.js";

interface PartyListCardProps {
  partyId: AnyDocumentId;
  isArchived?: boolean;
  isPinned?: boolean;
  renderMenu?: (party: Party) => ReactNode;
}

export function PartyListCard({
  partyId,
  isArchived = false,
  isPinned = false,
  renderMenu,
}: PartyListCardProps) {
  const navigate = useNavigate();
  const [party, handle] = useSuspenseDocument<Party>(partyId);

  if (!party || !handle) {
    return null;
  }

  const symbolOrFirstLetter =
    party.symbol || party.name.charAt(0).toUpperCase();
  const description = party.description.trim();
  const hasDescription = description.length > 0;
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
      className="group relative cursor-pointer rounded-xl border border-accent-200/80 bg-gradient-to-br from-white via-white to-accent-50/80 shadow-sm transition-all duration-200 ease-in-out has-[>[data-party-card-surface]:active]:scale-[0.99] focus-within:border-accent-500 focus-within:shadow-md hover:border-accent-300/90 hover:shadow-md dark:border-accent-800 dark:from-accent-950 dark:via-accent-950 dark:to-accent-900/70 dark:shadow-none dark:focus-within:border-accent-500 dark:hover:border-accent-700 dark:hover:shadow-none"
    >
      <button
        type="button"
        data-party-card-surface=""
        aria-hidden="true"
        tabIndex={-1}
        className="absolute inset-0 rounded-xl"
        onClick={() => {
          void navigate({
            to: "/party/$partyId",
            params: partyRouteParams,
            search: {
              tab: "expenses",
            },
          });
        }}
      />

      <div
        className={cn(
          "pointer-events-none relative flex gap-4 p-4",
          hasDescription ? "items-start" : "items-center",
        )}
      >
        <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-accent-950 text-xl font-semibold text-white shadow-sm dark:bg-black/35 dark:text-accent-50 dark:shadow-none">
          <span className="pt-0.5">{symbolOrFirstLetter}</span>

          {statusBadge ? (
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-accent-200 bg-white text-accent-700 shadow-sm dark:border-accent-700 dark:bg-accent-950 dark:text-accent-200">
              <IconWithFallback name={statusBadge.icon} size={11} />
              <span className="sr-only">{statusBadge.label}</span>
            </span>
          ) : null}
        </div>

        <div
          className={cn(
            "min-w-0 flex-1",
            hasDescription ? undefined : "flex min-h-14 items-center",
          )}
        >
          <Link
            data-party-card-interactive=""
            href={{
              to: "/party/$partyId",
              params: partyRouteParams,
            }}
            className={({ isFocusVisible, isHovered, defaultClassName }) =>
              cn(
                defaultClassName,
                "pointer-events-auto inline-flex max-w-full rounded-sm text-start outline-none transition-colors duration-200 ease-in-out",
                (isHovered || isFocusVisible) &&
                  "text-accent-700 dark:text-accent-200",
              )
            }
          >
            <span className="block truncate text-lg font-semibold tracking-tight text-accent-950 group-hover:text-accent-700 dark:text-accent-50 dark:group-hover:text-accent-200">
              {party.name}
            </span>
          </Link>

          {hasDescription ? (
            <p className="mt-1 text-sm leading-6 text-accent-700 dark:text-accent-300">
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
