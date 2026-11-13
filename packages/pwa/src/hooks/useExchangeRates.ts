import { useEffect, useSyncExternalStore } from "react";
import { getExchangeRatesStore, EXCHANGE_RATES_REFRESH_MS } from "../lib/exchangeRates";

import type { CurrencyCode } from "../lib/money";

export function useExchangeRates(base: CurrencyCode) {
  const store = getExchangeRatesStore(base);
  const table = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => {
    const refresh = () => {
      void store.refresh();
    };

    refresh();
    window.addEventListener("online", refresh);
    const timer = window.setInterval(refresh, EXCHANGE_RATES_REFRESH_MS);

    return () => {
      window.removeEventListener("online", refresh);
      window.clearInterval(timer);
    };
  }, [store]);

  return table;
}
