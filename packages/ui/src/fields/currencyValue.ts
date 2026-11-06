export function clampCurrencyValue(value: number, minValue?: number) {
  return minValue === undefined ? value : Math.max(value, minValue);
}
