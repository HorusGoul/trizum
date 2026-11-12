import type { RouterHistory } from "@tanstack/react-router";
import type { ModalSheetNavigation } from "@trizum/ui/modalSheetNavigation";

const guardStateKey = "__trizumSheetGuard";

/** Capture native methods before the router wraps them, keeping sheet guards out of routing. */
export function createSheetNavigation(createHistory: () => RouterHistory) {
  const pushState = window.history.pushState.bind(window.history);
  const back = window.history.back.bind(window.history);
  const history = createHistory();
  const sheets: { dismiss: () => boolean }[] = [];
  let unblock: (() => void) | undefined;

  let guard:
    | {
        href: string;
        key: string | undefined;
        release?: { done: Promise<void>; resolve: () => void };
      }
    | undefined;

  let navigating = false;
  let destroyed = false;
  const owner = crypto.randomUUID();

  function armGuard() {
    if (
      destroyed ||
      navigating ||
      guard ||
      sheets.length === 0 ||
      history.location.state.__TSR_index !== 0
    )
      return;
    history.flush();
    guard = { href: history.location.href, key: history.location.state.__TSR_key };
    pushState({ ...window.history.state, [guardStateKey]: owner }, "", guard.href);
  }

  function releaseGuard() {
    if (!guard) return Promise.resolve();

    if (guard.release) return guard.release.done;

    if (window.history.state?.[guardStateKey] !== owner) {
      guard = undefined;

      return Promise.resolve();
    }

    let resolve!: () => void;

    const done = new Promise<void>((complete) => {
      resolve = complete;
    });

    guard.release = { done, resolve };
    back();

    return done;
  }

  function unregister(sheet: (typeof sheets)[number]) {
    const index = sheets.indexOf(sheet);

    if (index !== -1) sheets.splice(index, 1);

    if (sheets.length === 0) {
      unblock?.();
      unblock = undefined;
      void releaseGuard();
    }
  }

  function handleBack() {
    const sheet = sheets.at(-1);

    if (!sheet) return false;

    if (sheet.dismiss()) unregister(sheet);

    return true;
  }

  function onGuardPop(event: PopStateEvent) {
    // Forward may revisit a guard after its sheet was closed. Skip that retired entry.
    if (!guard && event.state?.[guardStateKey] === owner) {
      event.stopImmediatePropagation();
      back();

      return;
    }

    if (
      !guard ||
      event.state?.[guardStateKey] === owner ||
      event.state?.__TSR_key !== guard.key ||
      window.location.pathname + window.location.search + window.location.hash !== guard.href
    )
      return;

    // This is the same-URL guard's return to its base entry, not a route traversal.
    event.stopImmediatePropagation();
    const released = guard.release;
    guard = undefined;

    if (!released) handleBack();
    released?.resolve();
    armGuard();
  }

  window.addEventListener("popstate", onGuardPop, { capture: true });

  const unsubscribe = history.subscribe(({ action }) => {
    if (action.type === "PUSH" || action.type === "REPLACE") armGuard();
  });

  const register: ModalSheetNavigation["register"] = (requestDismiss) => {
    const sheet = { dismiss: requestDismiss };
    sheets.push(sheet);
    unblock ??= history.block({
      enableBeforeUnload: false,
      blockerFn: async ({ action, currentLocation, nextLocation }) => {
        if (action === "PUSH" || action === "REPLACE") {
          navigating = true;

          try {
            await releaseGuard();
          } finally {
            navigating = false;
          }

          return false;
        }

        const isBack =
          action === "BACK" ||
          (action === "GO" && nextLocation.state.__TSR_index < currentLocation.state.__TSR_index);

        return isBack && handleBack();
      },
    });
    armGuard();

    return () => unregister(sheet);
  };

  async function destroy() {
    destroyed = true;
    sheets.length = 0;
    unblock?.();
    unsubscribe();
    await releaseGuard();
    window.removeEventListener("popstate", onGuardPop, { capture: true });
    history.destroy();
  }

  return { history, register, handleBack, destroy };
}
