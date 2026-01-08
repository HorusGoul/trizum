import { IconButton } from "#src/ui/IconButton.js";
import {
  useCanGoBack,
  useRouter,
  type ToOptions,
} from "@tanstack/react-router";
import { t } from "@lingui/macro";

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
      aria-label={t`Go Back`}
      className="flex-shrink-0"
      onPress={() => {
        if (canGoBack) {
          history.go(-1);
        } else {
          void navigate({
            ...fallbackOptions,
            replace: true,
          });
        }
      }}
    />
  );
}
