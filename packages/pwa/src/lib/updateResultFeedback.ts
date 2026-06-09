import { t } from "@lingui/core/macro";
import type { UpdateResult } from "#src/components/UpdateContext.tsx";
import { toast } from "sonner";

export function showUpdateResultFeedback(result: UpdateResult): void {
  const message = getUpdateResultFeedbackMessage(result);
  if (message) {
    toast.error(message);
  }
}

export function getUpdateResultFeedbackMessage(result: UpdateResult): string | null {
  if (result.status === "failed") {
    return t`Update failed. Please try again.`;
  }

  if (result.status === "not-allowed") {
    return t`Update can't be installed right now.`;
  }

  if (result.status === "unavailable") {
    return t`Update is no longer available.`;
  }

  return null;
}
