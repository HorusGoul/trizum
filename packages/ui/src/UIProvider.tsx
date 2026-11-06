import type { ReactNode } from "react";
import { I18nProvider } from "react-aria-components";
import { IconSpriteContext } from "./iconSpriteContext.js";

export interface UIProviderProps {
  children: ReactNode;
  locale: string;
  spriteHref: string;
}

/** Share the app's locale with React Aria and supply its generated icon sprite. */
export function UIProvider({ children, locale, spriteHref }: UIProviderProps) {
  return (
    <I18nProvider locale={locale}>
      <IconSpriteContext value={spriteHref}>{children}</IconSpriteContext>
    </I18nProvider>
  );
}
