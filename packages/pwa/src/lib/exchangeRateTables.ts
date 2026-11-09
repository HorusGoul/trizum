import { exchangeRatesSchema, type ExchangeRates } from "./api/exchangeRatesContract";
import snapshot from "./exchangeRatesSnapshot.json";
import type { CurrencyCode } from "./money";

const bundledTable = exchangeRatesSchema.parse(snapshot);

/** Rebase the compact bundled seed to the party currency before exposing it. */
export function getBundledExchangeRates(base: CurrencyCode): ExchangeRates {
  if (base === bundledTable.base) return bundledTable;
  const baseQuote = bundledTable.rates[base];
  const rates: ExchangeRates["rates"] = {};

  if (baseQuote) {
    for (const [currency, quote] of Object.entries(bundledTable.rates)) {
      const rate = quote.rate / baseQuote.rate;

      if (Number.isFinite(rate) && rate > 0) {
        rates[currency] = { rate, date: quote.date < baseQuote.date ? quote.date : baseQuote.date };
      }
    }
  }

  rates[base] = { rate: 1, date: baseQuote?.date ?? bundledTable.rates[bundledTable.base]!.date };

  return { base, rates };
}
