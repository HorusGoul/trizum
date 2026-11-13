import { useLingui } from "@lingui/react/macro";
import { toast } from "sonner";
import { trackEvent } from "#src/lib/analytics.ts";

export function useCopyPaymentDetails(details: string) {
  const { t } = useLingui();

  return async function copyDetails() {
    try {
      await navigator.clipboard.writeText(details);
      trackEvent("payment_contact_copied");
      toast.success(t`Payment details copied`);
    } catch {
      toast.error(t`Could not copy payment details. You can select and copy them manually.`);
    }
  };
}
