import { CurrencyText } from "#src/components/CurrencyText.tsx";
import { useCurrentParty } from "#src/hooks/useParty.ts";

export function Amount({ amount }: { amount: number }) {
  const { party } = useCurrentParty();

  return <CurrencyText amount={amount} currency={party.currency} className="text-4xl font-bold" />;
}
