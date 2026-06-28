const currencyDecimalPrecisionCache = new Map<string, number>();

export function getCurrencyDecimalPrecision(currency: string | undefined) {
  const cacheKey = currency ?? "";
  const cachedPrecision = currencyDecimalPrecisionCache.get(cacheKey);

  if (cachedPrecision !== undefined) {
    return cachedPrecision;
  }

  const precision =
    Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    })
      .formatToParts(1.23456789)
      .find((part) => part.type === "fraction")?.value.length ?? 2;

  currencyDecimalPrecisionCache.set(cacheKey, precision);
  return precision;
}
