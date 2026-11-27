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
          <div className="text-xs font-semibold tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-400">
            {caption}
          </div>
          <div className="h-px min-w-4 flex-1 bg-neutral-200/80 dark:bg-neutral-800" />
        </div>
        <div className="mt-1 truncate text-base font-semibold text-neutral-950 dark:text-neutral-50">
          {party.name}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm leading-5 text-neutral-700 dark:text-neutral-300">
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
    <span className="inline-flex max-w-full items-center gap-1.5 leading-5 text-neutral-950 dark:text-neutral-50">
      <TransferParticipantAvatar
        participant={participant}
        className="h-5 w-5 shrink-0 text-[0.5rem]"
      />
      <span className="truncate leading-5 font-medium">{children}</span>
    </span>
  );
}
