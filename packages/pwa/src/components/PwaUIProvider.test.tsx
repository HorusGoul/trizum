// @vitest-environment jsdom

import { I18nProvider } from "@lingui/react";
import { renderToStaticMarkup } from "react-dom/server";
import { useLocale } from "react-aria-components";
import { expect, it } from "vite-plus/test";
import { Avatar } from "@trizum/ui/Avatar";
import { Icon } from "@trizum/ui/Icon";
import spriteHref from "#src/generated/iconSprite.svg?url";
import { initializeI18n, setLocale } from "#src/lib/i18n.js";
import { PwaUIProvider } from "./PwaUIProvider.js";

function SharedUIProbe() {
  const { locale, direction } = useLocale();

  return (
    <div lang={locale} dir={direction}>
      <Icon icon="lucide.check" />
      <Avatar name="Alex" url="/avatar.png" />
    </div>
  );
}

it("shares the PWA locale and generated sprite with package components", () => {
  const i18n = initializeI18n("en");

  function render() {
    return renderToStaticMarkup(
      <I18nProvider i18n={i18n}>
        <PwaUIProvider>
          <SharedUIProbe />
        </PwaUIProvider>
      </I18nProvider>,
    );
  }

  const english = render();
  expect(english).toContain('lang="en"');
  expect(english).toContain(`href="${spriteHref}#lucide.check"`);
  expect(english).toContain("Alex&#x27;s avatar");

  setLocale("es");
  const spanish = render();
  expect(spanish).toContain('lang="es"');
  expect(spanish).toContain('alt="Avatar de Alex"');
  setLocale("en");
});
