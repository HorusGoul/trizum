import { setupI18n, type I18n } from "@lingui/core";
import type { MiddlewareHandler } from "hono";
import * as catalogEn from "#locale/en/messages.po";
import * as catalogEs from "#locale/es/messages.po";
import {
  DEFAULT_LOCALE,
  normalizeSupportedLocale,
  type SupportedLocale,
} from "../src/lib/locales.js";
import type { ApiHonoEnv } from "./env";

const LOCALE_PARAM = "lang";
const LEGACY_LOCALE_PARAM = "locale";
const messagesByLocale = {
  en: catalogEn.messages,
  es: catalogEs.messages,
} satisfies Record<SupportedLocale, Record<string, string>>;

export function createApiI18nMiddleware(): MiddlewareHandler<ApiHonoEnv> {
  return async (c, next) => {
    const locale = resolveRequestLocale(c.req.raw);

    c.set("locale", locale);
    c.set("i18n", createApiI18n(locale));

    await next();
  };
}

export function createApiI18n(locale: SupportedLocale): I18n {
  const i18n = setupI18n();

  i18n.load(messagesByLocale);
  i18n.activate(locale);

  return i18n;
}

export function resolveRequestLocale(request: Request): SupportedLocale {
  const requestUrl = new URL(request.url);

  return (
    resolveLocaleSearchParam(requestUrl.searchParams) ??
    resolveAcceptLanguageLocale(request.headers.get("Accept-Language")) ??
    DEFAULT_LOCALE
  );
}

function resolveLocaleSearchParam(searchParams: URLSearchParams) {
  return (
    normalizeSupportedLocale(searchParams.get(LOCALE_PARAM)) ??
    normalizeSupportedLocale(searchParams.get(LEGACY_LOCALE_PARAM))
  );
}

function resolveAcceptLanguageLocale(value: string | null) {
  if (!value) {
    return null;
  }

  const languageRanges = value
    .split(",")
    .map((range, index) => {
      const [languageTag, ...parameters] = range.trim().split(";");

      return {
        index,
        languageTag: languageTag?.trim(),
        quality: getAcceptLanguageQuality(parameters),
      };
    })
    .filter((range) => range.languageTag && range.quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index);

  for (const range of languageRanges) {
    const locale = normalizeSupportedLocale(range.languageTag);

    if (locale) {
      return locale;
    }
  }

  return null;
}

function getAcceptLanguageQuality(parameters: string[]) {
  const qualityParameter = parameters.find((parameter) =>
    parameter.trim().toLowerCase().startsWith("q="),
  );

  if (!qualityParameter) {
    return 1;
  }

  const quality = Number.parseFloat(qualityParameter.trim().slice(2));

  if (!Number.isFinite(quality)) {
    return 0;
  }

  return Math.min(1, Math.max(0, quality));
}
