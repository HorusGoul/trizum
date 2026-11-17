import { exchangeRatesSchema, type ExchangeRates } from "./api/exchangeRatesContract";
import snapshot from "./exchangeRatesSnapshot.json";
import type { CurrencyCode } from "./money";

const bundledTable = exchangeRatesSchema.parse(snapshot);

/** The table is quoted per party-currency unit; expenses need the inverse direction. */
export function getExchangeRate(table: ExchangeRates, from: CurrencyCode) {
  const quote = table.rates[from];

  if (!quote) return undefined;
  const rate = 1 / quote.rate;

  if (!Number.isFinite(rate) || rate <= 0) return undefined;

  return { rate, date: quote.date };
}

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

/** Retain bundled currencies while preferring the newest available quote. */
export function mergeExchangeRates(current: ExchangeRates, incoming: ExchangeRates): ExchangeRates {
  const rates = { ...current.rates };

  for (const [currency, value] of Object.entries(incoming.rates)) {
    if (!rates[currency] || value.date >= rates[currency].date) rates[currency] = value;
  }

  return { base: current.base, rates };
}
