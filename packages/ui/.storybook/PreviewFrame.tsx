import { setupI18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { useEffect, type ReactNode } from "react";
import { UIProvider } from "@trizum/ui/UIProvider";
import { setThemeHue } from "@trizum/ui/theme";
import { messages as en } from "@trizum/ui/locales/en";
import { messages as es } from "@trizum/ui/locales/es";
import spriteHref from "../src/generated/iconSprite.svg?url";
import "./styles.css";

const i18n = setupI18n({ locale: "en", messages: { en, es } });

export function PreviewFrame({
  children,
  locale,
  theme,
  hue,
}: {
  children: ReactNode;
  locale: string;
  theme: string;
  hue: number;
}) {
  useEffect(() => {
    i18n.activate(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = "ltr";
    document.documentElement.classList.toggle("dark", theme === "dark");
    setThemeHue(hue);
  }, [locale, theme, hue]);

  return (
    <I18nProvider i18n={i18n}>
      <UIProvider locale={locale} spriteHref={spriteHref}>
        <div className="mx-auto w-full max-w-xl p-6">{children}</div>
      </UIProvider>
    </I18nProvider>
  );
}
