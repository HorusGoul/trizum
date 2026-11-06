import { setupI18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";
import { Avatar } from "@trizum/ui/Avatar";
import { messages as en } from "@trizum/ui/locales/en";
import { messages as es } from "@trizum/ui/locales/es";

describe("package localization integration", () => {
  test("combines app and UI catalogs in one instance and switches both languages", () => {
    const i18n = setupI18n();
    i18n.load("en", { ...en, "app.title": "Account" });
    i18n.load("es", { ...es, "app.title": "Cuenta" });

    function render() {
      return renderToStaticMarkup(
        <I18nProvider i18n={i18n}>
          <Avatar name="Alex" url="/avatar.png" />
        </I18nProvider>,
      );
    }

    i18n.activate("en");
    expect(i18n._("app.title")).toBe("Account");
    expect(i18n._("ui.mediaGallery.close")).toBe("Close");
    expect(render()).toContain("Alex&#x27;s avatar");

    i18n.activate("es");
    expect(i18n._("app.title")).toBe("Cuenta");
    expect(i18n._("ui.mediaGallery.close")).toBe("Cerrar");
    expect(render()).toContain('alt="Avatar de Alex"');
  });

  test("allows context-specific alt text without changing shared catalogs", () => {
    const i18n = setupI18n({ locale: "es", messages: { es } });

    const markup = renderToStaticMarkup(
      <I18nProvider i18n={i18n}>
        <Avatar name="Alex" url="/avatar.png" alt="Foto del perfil" />
      </I18nProvider>,
    );

    expect(markup).toContain('alt="Foto del perfil"');
  });
});
