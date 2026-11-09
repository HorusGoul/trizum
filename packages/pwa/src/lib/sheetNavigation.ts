import type { RouterHistory } from "@tanstack/react-router";
import type { ModalSheetNavigation } from "@trizum/ui/modalSheetNavigation";

/** Keep Back local to the top open sheet, without adding duplicate history entries. */
export function createSheetNavigation(history: Pick<RouterHistory, "block">) {
  const sheets: { dismiss: () => boolean }[] = [];
  let unblock: (() => void) | undefined;

  function unregister(sheet: (typeof sheets)[number]) {
    const index = sheets.indexOf(sheet);

    if (index !== -1) sheets.splice(index, 1);

    if (sheets.length === 0) {
      unblock?.();
      unblock = undefined;
    }
  }

  function handleBack() {
    const sheet = sheets.at(-1);

    if (!sheet) return false;

    if (sheet.dismiss()) unregister(sheet);

    return true;
  }

  const register: ModalSheetNavigation["register"] = (requestDismiss) => {
    const sheet = { dismiss: requestDismiss };
    sheets.push(sheet);
    unblock ??= history.block({
      enableBeforeUnload: false,
      blockerFn: ({ action, currentLocation, nextLocation }) => {
        const isBack =
          action === "BACK" ||
          (action === "GO" && nextLocation.state.__TSR_index < currentLocation.state.__TSR_index);

        return isBack && handleBack();
      },
    });

    return () => unregister(sheet);
  };

  return { register, handleBack };
}
