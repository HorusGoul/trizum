import { view } from "@nkzw/fate";
import type { PartyEntity } from "#src/lib/data/entities.ts";
import { CurrencyText } from "#src/components/CurrencyText.tsx";
import { useCurrentParty } from "#src/hooks/useParty.ts";

const PartyCurrencyView = view<PartyEntity>()({
  id: true,
  available: true,
  currency: true,
});

export function Amount({ amount }: { amount: number }) {
  const { party } = useCurrentParty(PartyCurrencyView);

  return <CurrencyText amount={amount} currency={party.currency} className="text-4xl font-bold" />;
}
