export const SUPPORTED_LOCALES = ["en", "es"] as const;
export const DEFAULT_LOCALE = "en" as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function normalizeSupportedLocale(value: string | null | undefined): SupportedLocale | null {
  const normalizedLocale = value?.split("-")[0]?.toLowerCase();

  if (normalizedLocale && SUPPORTED_LOCALES.includes(normalizedLocale as SupportedLocale)) {
    return normalizedLocale as SupportedLocale;
  }

  return null;
}

export function getSupportedLocale(value: string | null | undefined): SupportedLocale {
  return normalizeSupportedLocale(value) ?? DEFAULT_LOCALE;
}
