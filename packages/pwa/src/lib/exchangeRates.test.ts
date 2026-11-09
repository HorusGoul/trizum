import { getBundledExchangeRates } from "./exchangeRateTables";
import { describe, expect, test, vi } from "vite-plus/test";
import {
  createExchangeRatesStore,
  EXCHANGE_RATES_REFRESH_MS,
  getExchangeRate,
} from "./exchangeRates";
import type { ExchangeRates } from "./api/exchangeRatesContract";

const table: ExchangeRates = {
  base: "EUR",
  rates: {
    EUR: { rate: 1, date: "2099-01-02" },
    USD: { rate: 1.2, date: "2099-01-01" },
    GBP: { rate: 0.8, date: "2099-01-02" },
  },
};

function memoryStorage(initial: string | null = null) {
  let value = initial;

  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
}

describe("exchange rates", () => {
  test("inverts quotes to convert foreign amounts into the party currency", () => {
    expect(getExchangeRate(table, "USD")).toEqual({ rate: 1 / 1.2, date: "2099-01-01" });
    expect(getExchangeRate(table, "GBP")?.rate).toBeCloseTo(1 / 0.8);
    expect(getExchangeRate(table, "EUR")?.rate).toBe(1);
    expect(getExchangeRate(table, "XXX")).toBeUndefined();
  });

  test.each([
    null,
    "not JSON",
    '{"base":"EUR","rates":{"EUR":{"rate":1,"date":"2099-01-01"},"USD":{"rate":-1,"date":"2099-01-01"}}}',
  ])("ships usable rates on first offline use with unusable cache %s", async (initial) => {
    const store = createExchangeRatesStore("EUR", {
      storage: () => memoryStorage(initial),
      load: async () => {
        throw new Error("Offline");
      },
    });

    expect(store.getSnapshot()).toEqual(getBundledExchangeRates("EUR"));
    await store.refresh();
    expect(getExchangeRate(store.getSnapshot(), "USD")?.rate).toBeGreaterThan(0);
  });

  test("deduplicates refreshes, persists new rates and keeps them across store instances", async () => {
    const storage = memoryStorage();
    const load = vi.fn<() => Promise<ExchangeRates>>(async () => table);
    let now = 1000;
    const store = createExchangeRatesStore("EUR", { storage: () => storage, load, now: () => now });
    const listener = vi.fn<() => void>();
    const unsubscribe = store.subscribe(listener);
    await Promise.all([store.refresh(), store.refresh()]);
    expect(load).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledOnce();
    await store.refresh();
    expect(load).toHaveBeenCalledOnce();
    expect(
      createExchangeRatesStore("EUR", { storage: () => storage }).getSnapshot().rates.USD,
    ).toEqual(table.rates.USD);
    now += EXCHANGE_RATES_REFRESH_MS;
    await store.refresh();
    expect(load).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  test("a bundled fallback response never replaces newer saved rates", async () => {
    const store = createExchangeRatesStore("EUR", {
      storage: () => memoryStorage(JSON.stringify(table)),
      load: async () => getBundledExchangeRates("EUR"),
    });

    await store.refresh();
    expect(store.getSnapshot().rates.USD).toEqual(table.rates.USD);
  });

  test("storage denial does not prevent refreshes in memory", async () => {
    const store = createExchangeRatesStore("EUR", {
      storage: () => {
        throw new Error("Storage denied");
      },
      load: async () => table,
    });

    await store.refresh();
    expect(store.getSnapshot().rates.USD).toEqual(table.rates.USD);
  });
});

test("rebases bundled rates to the party currency on first offline use", () => {
  const seed = getBundledExchangeRates("EUR");
  const store = createExchangeRatesStore("GBP", { storage: () => memoryStorage() });
  const table = store.getSnapshot();
  expect(table.base).toBe("GBP");
  expect(table.rates.GBP?.rate).toBe(1);
  expect(getExchangeRate(table, "USD")?.rate).toBeCloseTo(
    seed.rates.GBP!.rate / seed.rates.USD!.rate,
  );
  expect(getBundledExchangeRates("XXX")).toEqual({
    base: "XXX",
    rates: { XXX: { rate: 1, date: seed.rates.EUR!.date } },
  });
});

test("keeps storage and refreshes isolated for different party currencies", async () => {
  const values = new Map<string, string>();

  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };

  const eur = createExchangeRatesStore("EUR", { storage: () => storage, load: async () => table });

  const usdTable: ExchangeRates = {
    base: "USD",
    rates: {
      USD: { rate: 1, date: "2099-01-02" },
      EUR: { rate: 0.75, date: "2099-01-02" },
    },
  };

  const usd = createExchangeRatesStore("USD", {
    storage: () => storage,
    load: async () => usdTable,
  });

  await Promise.all([eur.refresh(), usd.refresh()]);
  expect(values.size).toBe(2);
  expect(createExchangeRatesStore("EUR", { storage: () => storage }).getSnapshot()).toEqual(
    eur.getSnapshot(),
  );
  expect(createExchangeRatesStore("USD", { storage: () => storage }).getSnapshot()).toEqual(
    usd.getSnapshot(),
  );
  expect(getExchangeRate(usd.getSnapshot(), "EUR")?.rate).toBe(1 / 0.75);
});

test("rejects cached or refreshed tables for another party currency", async () => {
  const store = createExchangeRatesStore("GBP", {
    storage: () => memoryStorage(JSON.stringify(table)),
    load: async () => table,
  });

  await store.refresh();
  expect(store.getSnapshot()).toEqual(getBundledExchangeRates("GBP"));
});
