import { t } from "@lingui/core/macro";
import type { ToOptions } from "@tanstack/react-router";
import { useBackNavigation } from "#src/hooks/useBackNavigation.js";
import { IconButton } from "#src/ui/IconButton.js";

export function BackButton({ fallbackOptions }: { fallbackOptions: Omit<ToOptions, "replace"> }) {
  const goBack = useBackNavigation(fallbackOptions);

  return (
    <IconButton
      icon="lucide.arrow-left"
      aria-label={t`Go Back`}
      className="shrink-0"
      onPress={goBack}
    />
  );
}
