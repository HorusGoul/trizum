import { IconButton } from "#src/ui/IconButton.js";
import {
  Route,
  useCanGoBack,
  useRouter,
  type RegisteredRouter,
  type ToOptions,
} from "@tanstack/react-router";
import type { ComponentProps } from "react";

export function BackButton({
  fallbackOptions,
}: {
  fallbackOptions: Omit<ToOptions, "replace">;
}) {
  const { history, navigate } = useRouter();
  const canGoBack = useCanGoBack();

  return (
    <IconButton
      icon="#lucide/arrow-left"
      aria-label="Go Back"
      onPress={() => {
        if (canGoBack) {
          history.go(-1);
        } else {
          navigate({
            ...fallbackOptions,
            replace: true,
          });
        }
      }}
    />
  );
}
