import { t } from "@lingui/core/macro";
import { toast } from "sonner";

const UPDATE_TOAST_PREVIEW_TRANSITION_DELAY_MS = 800;

export const UPDATE_TOAST_ID = "update-toast";
export const UPDATE_TOAST_PREVIEW_SEARCH_PARAM = "__trizum_update_toast";

export function previewUpdateToastTransition({
  transitionDelayMs = UPDATE_TOAST_PREVIEW_TRANSITION_DELAY_MS,
}: {
  transitionDelayMs?: number;
} = {}) {
  toast(t`Update available`, {
    action: {
      label: t`Reload`,
      onClick: () => {
        showUpdatingToast({ duration: Infinity });
      },
    },
    duration: Infinity,
    id: UPDATE_TOAST_ID,
  });

  window.setTimeout(() => {
    showUpdatingToast({ duration: Infinity });
  }, transitionDelayMs);
}

export function showUpdatingToast({ duration }: { duration?: number } = {}) {
  toast.loading(t`Updating trizum...`, {
    action: null,
    duration,
    id: UPDATE_TOAST_ID,
  });
}
