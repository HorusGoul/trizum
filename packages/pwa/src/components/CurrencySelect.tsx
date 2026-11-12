import { useLingui } from "@lingui/react/macro";
import { AppSelect, SelectItem } from "@trizum/ui/Select";
import { isCurrencyCode, type CurrencyCode } from "#src/lib/money.ts";

export function CurrencySelect({
  currency,
  partyCurrency,
  onChange,
  onBlur,
  className,
}: {
  currency: CurrencyCode;
  partyCurrency: CurrencyCode;
  onChange: (currency: CurrencyCode) => void;
  onBlur?: () => void;
  className?: string;
}) {
  const { t, i18n } = useLingui();
  const names = new Intl.DisplayNames([i18n.locale], { type: "currency" });

  const currencies = Array.from(
    new Set([partyCurrency, currency, ...Intl.supportedValuesOf("currency")]),
  )
    .filter(isCurrencyCode)
    .map((id) => ({ id, name: `${id} · ${names.of(id) ?? id}` }));

  return (
    <AppSelect
      label={t`Currency`}
      items={currencies}
      selectedKey={currency}
      className={className}
      onBlur={onBlur}
      onSelectionChange={(selection) => {
        const key = String(selection);

        if (isCurrencyCode(key) && key !== currency) onChange(key);
      }}
    >
      {(item) => (
        <SelectItem key={item.id} value={item} textValue={item.name}>
          {item.name}
        </SelectItem>
      )}
    </AppSelect>
  );
}
