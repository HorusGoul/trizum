import { useCanGoBack, useRouter, type ToOptions } from "@tanstack/react-router";

export function useBackNavigation(fallbackOptions: Omit<ToOptions, "replace">) {
  const { history, navigate } = useRouter();
  const canGoBack = useCanGoBack();

  return function goBack() {
    if (canGoBack) {
      history.go(-1);
      return;
    }

    void navigate({
      ...fallbackOptions,
      replace: true,
    });
  };
}
