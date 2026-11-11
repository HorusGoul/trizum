import { useCurrentPartyId } from "#src/hooks/useCurrentPartyId.ts";
import type { PartyEntity } from "#src/lib/data/entities.ts";
import { requireAvailable } from "#src/lib/data/availability.ts";
import { useFateClient, useView } from "react-fate";
import { view } from "@nkzw/fate";
import { CurrencyText } from "#src/components/CurrencyText.tsx";

const PartyCurrencyView = view<PartyEntity>()({
  id: true,
  available: true,
  currency: true,
});

export function Amount({ amount }: { amount: number }) {
  const client = useFateClient();
  const partyId = useCurrentPartyId();

  const party = requireAvailable(
    useView(PartyCurrencyView, client.ref<PartyEntity>("Party", partyId, PartyCurrencyView)),
  );

  return <CurrencyText amount={amount} currency={party.currency} className="text-4xl font-bold" />;
}
