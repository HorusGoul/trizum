import { useLingui } from "@lingui/react";
import type { ReactNode } from "react";
import { UIProvider } from "@trizum/ui/UIProvider";
import type { ModalSheetNavigation } from "@trizum/ui/modalSheetNavigation";
import spriteHref from "#src/generated/iconSprite.svg?url";

/** Bridge locale, icons, and app-owned sheet navigation to shared UI components. */
export function PwaUIProvider({
  children,
  modalSheetNavigation,
}: {
  children: ReactNode;
  modalSheetNavigation?: ModalSheetNavigation;
}) {
  const { i18n } = useLingui();

  return (
    <UIProvider
      locale={i18n.locale}
      spriteHref={spriteHref}
      modalSheetNavigation={modalSheetNavigation}
    >
      {children}
    </UIProvider>
  );
}
