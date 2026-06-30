import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { CurrencyCode } from "#src/lib/money.ts";
import { CurrencyText } from "#src/components/CurrencyText.tsx";
import type { Party, PartyParticipant } from "#src/models/party.ts";
import { ReviewParticipantInline, ReviewPartyRow } from "./ReviewPartyRow.js";

export function TransferReviewCard({
  amount,
  currency,
  originParty,
  destinationParty,
  from,
  to,
  destinationDebtor,
  destinationCreditor,
}: {
  amount: number;
  currency: CurrencyCode;
  originParty: Party;
  destinationParty?: Party;
  from: PartyParticipant;
  to: PartyParticipant;
  destinationDebtor: PartyParticipant | null;
  destinationCreditor: PartyParticipant | null;
}) {
  const fromName = from.name;
  const toName = to.name;
  const destinationDebtorName = destinationDebtor?.name ?? "";
  const destinationCreditorName = destinationCreditor?.name ?? "";

  return (
    <div className="grid gap-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-accent-700 dark:text-accent-300">
            <Trans>Debt being moved</Trans>
          </div>
          <div className="mt-1 text-xl font-semibold tracking-tight">
            {fromName} <span className="text-accent-500">→</span> {toName}
          </div>
        </div>

        <CurrencyText currency={currency} amount={amount} className="text-2xl font-semibold" />
      </div>

      <div className="grid gap-6">
        <ReviewPartyRow caption={t`Settled in`} party={originParty}>
          <Trans>
            <ReviewParticipantInline participant={from}>{fromName}</ReviewParticipantInline> stops
            owing <ReviewParticipantInline participant={to}>{toName}</ReviewParticipantInline>
          </Trans>
        </ReviewPartyRow>

        {destinationParty && destinationDebtor && destinationCreditor ? (
          <ReviewPartyRow caption={t`Moved to`} party={destinationParty}>
            <Trans>
              <ReviewParticipantInline participant={destinationCreditor}>
                {destinationCreditorName}
              </ReviewParticipantInline>{" "}
              is owed by{" "}
              <ReviewParticipantInline participant={destinationDebtor}>
                {destinationDebtorName}
              </ReviewParticipantInline>
            </Trans>
          </ReviewPartyRow>
        ) : null}
      </div>
    </div>
  );
}
