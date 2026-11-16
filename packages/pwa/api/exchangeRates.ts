import { z } from "zod";
import type { CurrencyCode } from "../src/lib/money";
import {
  exchangeRateSchema,
  exchangeRateCurrencySchema,
  exchangeRatesSchema,
  type ExchangeRates,
} from "../src/lib/api/exchangeRatesContract";
import { getBundledExchangeRates } from "../src/lib/exchangeRateTables";

const upstreamRatesSchema = z
  .array(
    exchangeRateSchema.extend({
      base: exchangeRateCurrencySchema,
      quote: z.string(),
    }),
  )
  .min(1);

const CACHE_SECONDS = 6 * 60 * 60;

/** Shared reference-rate lookup and edge cache for web and agent expenses. */
export function createExchangeRatesLoader({
  fetchRates = fetch,
  getCache = () => caches.default,
}: {
  fetchRates?: typeof fetch;
  getCache?: () => Pick<Cache, "match" | "put">;
} = {}) {
  return async (
    base: CurrencyCode,
    requestUrl: string,
    waitUntil: (task: Promise<unknown>) => void,
  ) => {
    // Only the validated base affects caching; arbitrary query strings cannot multiply entries.
    const cacheUrl = new URL("/api/exchange-rates", requestUrl);
    cacheUrl.searchParams.set("base", base);
    const key = new Request(cacheUrl);
    const cache = getCache();
    const cached = await cache.match(key);

    if (cached) {
      return {
        table: exchangeRatesSchema.parse(await cached.json()),
        cacheControl: cached.headers.get("Cache-Control") ?? `public, max-age=${CACHE_SECONDS}`,
      };
    }

    let table: ExchangeRates = getBundledExchangeRates(base);
    let maxAge = 300;

    try {
      const response = await fetchRates(`https://api.frankfurter.dev/v2/rates?base=${base}`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) throw new Error("Exchange rates are unavailable");
      const rows = upstreamRatesSchema.parse(await response.json());

      if (rows.some((row) => row.base !== base))
        throw new Error("Unexpected upstream base currency");
      const rates: ExchangeRates["rates"] = {};

      for (const row of rows) {
        if (/^[A-Z]{3}$/.test(row.quote)) rates[row.quote] = { rate: row.rate, date: row.date };
      }

      const date = rows
        .map((row) => row.date)
        .sort()
        .at(-1)!;

      rates[base] = { rate: 1, date };
      table = exchangeRatesSchema.parse({ base, rates });
      maxAge = CACHE_SECONDS;
    } catch {
      // Bundled reference rates keep both the endpoint and first offline use available.
    }

    waitUntil(
      cache.put(
        key,
        Response.json(table, {
          headers: { "Cache-Control": `public, max-age=${maxAge}` },
        }),
      ),
    );

    return { table, cacheControl: `public, max-age=${maxAge}` };
  };
}

export const loadExchangeRates = createExchangeRatesLoader();
