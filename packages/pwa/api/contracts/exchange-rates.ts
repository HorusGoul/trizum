import { createRoute } from "@hono/zod-openapi";
import {
  exchangeRatesSchema,
  exchangeRatesQuerySchema,
} from "../../src/lib/api/exchangeRatesContract";

export const getExchangeRatesRoute = createRoute({
  method: "get",
  operationId: "getExchangeRates",
  path: "/",
  request: { query: exchangeRatesQuerySchema },
  responses: {
    200: {
      description:
        "Daily reference rates per unit of the requested party currency, with each currency's publication date.",
      content: { "application/json": { schema: exchangeRatesSchema, exchangeRatesQuerySchema } },
    },
  },
  summary: "Get cached exchange rates",
  tags: ["Currencies"],
});
