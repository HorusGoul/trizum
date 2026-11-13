import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";
import { getExchangeRatesRoute } from "../contracts/exchange-rates";
import {
  exchangeRateSchema,
  exchangeRateCurrencySchema,
  exchangeRatesSchema,
  type ExchangeRates,
} from "../../src/lib/api/exchangeRatesContract";
import { getBundledExchangeRates } from "../../src/lib/exchangeRateTables";

const upstreamRatesSchema = z
  .array(
    exchangeRateSchema.extend({
      base: exchangeRateCurrencySchema,
      quote: z.string(),
    }),
  )
  .min(1);

const CACHE_SECONDS = 6 * 60 * 60;

export function createExchangeRatesRoute({
  fetchRates = fetch,
  getCache = () => caches.default,
}: {
  fetchRates?: typeof fetch;
  getCache?: () => Pick<Cache, "match" | "put">;
} = {}) {
  return new OpenAPIHono().openapi(getExchangeRatesRoute, async (c) => {
    const { base } = c.req.valid("query");
    // Only the validated base affects caching; arbitrary query strings cannot multiply entries.
    const cacheUrl = new URL("/api/exchange-rates", c.req.url);
    cacheUrl.searchParams.set("base", base);
    const key = new Request(cacheUrl);
    const cache = getCache();
    const cached = await cache.match(key);

    if (cached) {
      c.header(
        "Cache-Control",
        cached.headers.get("Cache-Control") ?? `public, max-age=${CACHE_SECONDS}`,
      );

      return c.json(exchangeRatesSchema.parse(await cached.json()), 200);
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

    c.executionCtx.waitUntil(
      cache.put(
        key,
        Response.json(table, {
          headers: { "Cache-Control": `public, max-age=${maxAge}` },
        }),
      ),
    );
    c.header("Cache-Control", `public, max-age=${maxAge}`);

    return c.json(table, 200);
  });
}

export const exchangeRatesRoute = createExchangeRatesRoute();

export type ExchangeRatesRoute = typeof exchangeRatesRoute;
