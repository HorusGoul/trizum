import type { Party, PartyParticipant } from "#src/models/party.ts";
import { PartySymbolBadge } from "./PartySymbolBadge.js";
import { TransferParticipantAvatar } from "./TransferParticipantAvatar.js";

export function ReviewPartyRow({
  caption,
  party,
  children,
}: {
  caption: string;
  party: Party;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <PartySymbolBadge party={party} className="mt-0.5 h-10 w-10 flex-shrink-0 text-base" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-500 dark:text-accent-400">
            {caption}
          </div>
          <div className="h-px min-w-4 flex-1 bg-accent-200/80 dark:bg-accent-800" />
        </div>
        <div className="mt-1 truncate text-base font-semibold text-accent-950 dark:text-accent-50">
          {party.name}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm leading-5 text-accent-700 dark:text-accent-300">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ReviewParticipantInline({
  participant,
  children,
}: {
  participant: PartyParticipant;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 leading-5 text-accent-950 dark:text-accent-50">
      <TransferParticipantAvatar
        participant={participant}
        className="h-5 w-5 flex-shrink-0 text-[0.5rem]"
      />
      <span className="truncate font-medium leading-5">{children}</span>
    </span>
  );
}
