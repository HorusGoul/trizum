import { exchangeRatesSchema, type ExchangeRates } from "./api/exchangeRatesContract";
import { getBundledExchangeRates } from "./exchangeRateTables";
import { trizumApiClient } from "./trizumApiClient";
import type { CurrencyCode } from "./money";

export const EXCHANGE_RATES_REFRESH_MS = 6 * 60 * 60 * 1000;

/** The table is quoted per party-currency unit; expenses need the inverse direction. */
export function getExchangeRate(table: ExchangeRates, from: CurrencyCode) {
  const quote = table.rates[from];

  if (!quote) return undefined;
  const rate = 1 / quote.rate;

  if (!Number.isFinite(rate) || rate <= 0) return undefined;

  return { rate, date: quote.date };
}

export function createExchangeRatesStore(
  base: CurrencyCode,
  {
    load = () => trizumApiClient.exchangeRates.get(base),
    storage = () => localStorage,
    now = Date.now,
  }: {
    load?: () => Promise<ExchangeRates>;
    storage?: () => Pick<Storage, "getItem" | "setItem">;
    now?: () => number;
  } = {},
) {
  const storageKey = `trizum.exchange-rates.v1.${base}`;
  let table: ExchangeRates | undefined;
  let refreshedAt = 0;
  let inFlight: Promise<void> | undefined;
  const listeners = new Set<() => void>();

  function getSnapshot() {
    if (table) return table;
    table = getBundledExchangeRates(base);

    try {
      const cached = exchangeRatesSchema.safeParse(
        JSON.parse(storage().getItem(storageKey) ?? "null"),
      );

      if (cached.success && cached.data.base === base)
        table = mergeExchangeRates(table, cached.data);
    } catch {
      // Storage may be unavailable or contain corrupt data. The bundled table is sufficient.
    }

    return table;
  }

  return {
    getSnapshot,
    subscribe(this: void, listener: () => void) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    refresh() {
      if (inFlight) return inFlight;

      if (refreshedAt && now() - refreshedAt < EXCHANGE_RATES_REFRESH_MS) return Promise.resolve();
      inFlight = load()
        .then((value) => {
          const incoming = exchangeRatesSchema.parse(value);

          if (incoming.base !== base)
            throw new Error("Exchange rate base does not match the party currency");
          table = mergeExchangeRates(getSnapshot(), incoming);
          refreshedAt = now();

          try {
            storage().setItem(storageKey, JSON.stringify(table));
          } catch {
            // A full or disabled store must not prevent use of refreshed rates in memory.
          }

          for (const listener of listeners) listener();
        })
        .catch(() => {
          // Network failures leave the last known rates available offline.
        })
        .finally(() => {
          inFlight = undefined;
        });

      return inFlight;
    },
  };
}

function mergeExchangeRates(current: ExchangeRates, incoming: ExchangeRates): ExchangeRates {
  const rates = { ...current.rates };

  for (const [currency, value] of Object.entries(incoming.rates)) {
    if (!rates[currency] || value.date >= rates[currency].date) rates[currency] = value;
  }

  return { base: current.base, rates };
}

const stores = new Map<CurrencyCode, ReturnType<typeof createExchangeRatesStore>>();

export function getExchangeRatesStore(base: CurrencyCode) {
  let store = stores.get(base);

  if (!store) {
    store = createExchangeRatesStore(base);
    stores.set(base, store);
  }

  return store;
}

/** Start with cached rates if a slow refresh would otherwise block the expense editor. */
export async function getLatestExchangeRates(base: CurrencyCode) {
  const store = getExchangeRatesStore(base);
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      store.refresh(),
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, 1500);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }

  return store.getSnapshot();
}
