import type { ParsedLocation, RouterHistory, ToOptions } from "@tanstack/react-router";

type NavigateWithReplace<TOptions> = (options: TOptions & { replace?: boolean }) => void;
type HrefLocation = Pick<RouterHistory["location"], "href">;

export function shouldReplaceNavigation(currentHref: string, nextHref: string) {
  return currentHref === nextHref;
}

export function navigateWithoutDuplicateEntry<TOptions extends ToOptions>(
  currentLocation: Pick<ParsedLocation, "href">,
  buildLocation: (options: TOptions) => Pick<ParsedLocation, "href">,
  navigate: NavigateWithReplace<TOptions>,
  options: TOptions & { replace?: boolean },
) {
  navigate({
    ...options,
    replace:
      options.replace ?? shouldReplaceNavigation(currentLocation.href, buildLocation(options).href),
  });
}

export function pushHistoryWithoutDuplicateEntry(
  history: {
    location: HrefLocation;
    push: (href: string) => void;
    replace: (href: string) => void;
  },
  href: string,
) {
  if (shouldReplaceNavigation(history.location.href, href)) {
    history.replace(href);
    return;
  }

  history.push(href);
}

export function preventDuplicateHistoryEntries(history: RouterHistory): RouterHistory {
  const push = history.push.bind(history);
  const replace = history.replace.bind(history);

  history.push = (path, state, navigateOptions) => {
    if (shouldReplaceNavigation(history.location.href, path)) {
      replace(path, state, navigateOptions);
      return;
    }

    push(path, state, navigateOptions);
  };

  return history;
}

export function closeRouteState(
  currentLocation: Pick<ParsedLocation, "state">,
  history: Pick<RouterHistory, "go">,
  replaceFallback: () => void,
) {
  if (currentLocation.state.__TSR_index > 0) {
    history.go(-1);
    return;
  }

  replaceFallback();
}

export function shouldNavigateToPartyListOnNativeBack({
  canGoBack,
  pathname,
}: {
  canGoBack: boolean;
  pathname: string;
}) {
  return !canGoBack && (pathname === "/party" || pathname.startsWith("/party/"));
}
