import { z } from "zod";
import { isCurrencyCode, type CurrencyCode } from "../money";

// SAFETY: The refine validates the currency before the transform narrows its type.
export const exchangeRateCurrencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .refine(isCurrencyCode)
  .transform((value) => value as CurrencyCode);

export const exchangeRatesQuerySchema = z.object({ base: exchangeRateCurrencySchema });

export const exchangeRateSchema = z.object({
  rate: z.number().positive(),
  date: z.iso.date(),
});

export const exchangeRatesSchema = z
  .object({
    base: exchangeRateCurrencySchema,
    rates: z.record(z.string().regex(/^[A-Z]{3}$/), exchangeRateSchema),
  })
  .refine((table) => table.rates[table.base]?.rate === 1);

export type ExchangeRates = z.infer<typeof exchangeRatesSchema>;
