import { useLingui } from "@lingui/react";
import type { ReactNode } from "react";
import { UIProvider } from "@trizum/ui/UIProvider";
import spriteHref from "#src/generated/iconSprite.svg?url";

/** Bridge the app's active locale and generated sprite to shared UI components. */
export function PwaUIProvider({ children }: { children: ReactNode }) {
  const { i18n } = useLingui();

  return (
    <UIProvider locale={i18n.locale} spriteHref={spriteHref}>
      {children}
    </UIProvider>
  );
}
