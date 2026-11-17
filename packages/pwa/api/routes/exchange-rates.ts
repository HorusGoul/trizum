import { OpenAPIHono } from "@hono/zod-openapi";
import { getExchangeRatesRoute } from "../contracts/exchange-rates";
import { createExchangeRatesLoader } from "../exchangeRates";

export function createExchangeRatesRoute(
  options: Parameters<typeof createExchangeRatesLoader>[0] = {},
) {
  const load = createExchangeRatesLoader(options);

  return new OpenAPIHono().openapi(getExchangeRatesRoute, async (c) => {
    const { base } = c.req.valid("query");

    const { table, cacheControl } = await load(base, c.req.url, (task) =>
      c.executionCtx.waitUntil(task),
    );

    c.header("Cache-Control", cacheControl);

    return c.json(table, 200);
  });
}

export const exchangeRatesRoute = createExchangeRatesRoute();

export type ExchangeRatesRoute = typeof exchangeRatesRoute;
