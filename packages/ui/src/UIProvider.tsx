import type { ReactNode } from "react";
import { I18nProvider } from "react-aria-components";
import { IconSpriteContext } from "./iconSpriteContext.js";
import { ModalSheetNavigationContext, type ModalSheetNavigation } from "./modalSheetNavigation.js";

export interface UIProviderProps {
  children: ReactNode;
  locale: string;
  spriteHref: string;
  modalSheetNavigation?: ModalSheetNavigation;
}

/** Share the app's locale with React Aria and supply its generated icon sprite. */
export function UIProvider({
  children,
  locale,
  spriteHref,
  modalSheetNavigation,
}: UIProviderProps) {
  return (
    <I18nProvider locale={locale}>
      <ModalSheetNavigationContext value={modalSheetNavigation}>
        <IconSpriteContext value={spriteHref}>{children}</IconSpriteContext>
      </ModalSheetNavigationContext>
    </I18nProvider>
  );
}
