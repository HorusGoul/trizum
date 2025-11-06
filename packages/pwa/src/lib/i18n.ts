import { i18n } from "@lingui/core";
import * as catalogEn from "#locale/en/messages.po";
import * as catalogEs from "#locale/es/messages.po";

/**
 * Supported locales in the application
 */
export const SUPPORTED_LOCALES = ["en", "es"] as const;

/**
 * Default fallback locale
 */
export const DEFAULT_LOCALE = "en" as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Retrieves the browser locale or returns the default locale.
 * Normalizes the locale (e.g., "en-US" -> "en") and validates against supported locales.
 *
 * @returns A supported locale code
 */
export function getBrowserLocale(): SupportedLocale {
  // Try to get locale from browser
  const browserLocale = navigator.language ?? navigator.languages?.[0];

  if (browserLocale) {
    // Extract base locale (e.g., "en-US" -> "en")
    const baseLocale = browserLocale.split("-")[0]?.toLowerCase();

    // Check if it's a supported locale
    if (
      baseLocale &&
      SUPPORTED_LOCALES.includes(baseLocale as SupportedLocale)
    ) {
      return baseLocale as SupportedLocale;
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Loads all message catalogs into lingui.
 * This should be called once during app bootstrap.
 */
export function loadAllCatalogs(): void {
  i18n.load("en", catalogEn.messages);
  i18n.load("es", catalogEs.messages);
}

/**
 * Initializes i18n for the application.
 * Loads all catalogs, retrieves the browser locale, and configures lingui.
 *
 * @param locale - Optional locale to use. If not provided, will use browser locale.
 * @returns The i18n instance
 */
export function initializeI18n(locale?: SupportedLocale): typeof i18n {
  loadAllCatalogs();

  const targetLocale = locale ?? getBrowserLocale();

  i18n.activate(targetLocale);
  document.documentElement.lang = i18n.locale;

  // Set up listener for future locale changes
  i18n.on("change", () => {
    document.documentElement.lang = i18n.locale;
  });

  return i18n;
}

export function setLocale(locale: SupportedLocale): void {
  i18n.activate(locale);
}
