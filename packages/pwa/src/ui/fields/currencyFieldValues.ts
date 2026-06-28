export function clampCurrencyFieldValue(value: number, minValue: number | undefined) {
  if (!Number.isFinite(value)) {
    return minValue ?? 0;
  }

  return minValue === undefined ? value : Math.max(value, minValue);
}

export function sanitizeCurrencyFieldInput(value: string, decimalPrecision: number) {
  const normalizedValue = value.replace(/,/g, ".");
  const numericValue = normalizedValue.replace(/[^0-9.]/g, "");
  const lastDotIndex = numericValue.lastIndexOf(".");
  let sanitizedValue = "";

  for (let index = 0; index < numericValue.length; index++) {
    const character = numericValue[index];

    if (character !== "." || index === lastDotIndex) {
      sanitizedValue += character;
    }
  }

  const decimalSeparatorIndex = sanitizedValue.lastIndexOf(".");

  if (decimalSeparatorIndex !== -1) {
    const decimalPart = sanitizedValue.substring(decimalSeparatorIndex + 1);

    if (decimalPart.length > decimalPrecision) {
      sanitizedValue = sanitizedValue.substring(0, decimalSeparatorIndex + 1 + decimalPrecision);
    }
  }

  return sanitizedValue;
}
