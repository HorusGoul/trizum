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
      <PartySymbolBadge party={party} className="mt-0.5 h-10 w-10 shrink-0 text-base" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-accent-500 dark:text-accent-400 text-xs font-semibold tracking-[0.16em] uppercase">
            {caption}
          </div>
          <div className="bg-accent-200/80 dark:bg-accent-800 h-px min-w-4 flex-1" />
        </div>
        <div className="text-accent-950 dark:text-accent-50 mt-1 truncate text-base font-semibold">
          {party.name}
        </div>

        <div className="text-accent-700 dark:text-accent-300 mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm leading-5">
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
    <span className="text-accent-950 dark:text-accent-50 inline-flex max-w-full items-center gap-1.5 leading-5">
      <TransferParticipantAvatar
        participant={participant}
        className="h-5 w-5 shrink-0 text-[0.5rem]"
      />
      <span className="truncate leading-5 font-medium">{children}</span>
    </span>
  );
}
