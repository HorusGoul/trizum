import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@trizum/ui/Button";
import { Icon } from "@trizum/ui/Icon";
import { toast } from "sonner";
import { trackEvent } from "#src/lib/analytics.ts";
import { getPaymentLink, paymentMethodLabels } from "#src/lib/paymentMethods.ts";
import type { PaymentMethodType } from "#src/models/paymentMethod.ts";

export function PaymentMethodItem({ type, details }: { type: PaymentMethodType; details: string }) {
  const { t } = useLingui();
  const methodName = t(paymentMethodLabels[type]);
  const href = getPaymentLink(type, details);

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(details);
      trackEvent("payment_contact_copied");
      toast.success(t`Payment details copied`);
    } catch {
      toast.error(t`Could not copy payment details. You can select and copy them manually.`);
    }
  }

  return (
    <section className="dark:bg-accent-900 flex flex-col gap-3 rounded-xl bg-white p-4">
      <h3 className="text-lg font-semibold">{methodName}</h3>
      {type === "bizum" ? (
        <p className="text-accent-700 dark:text-accent-300">
          <Trans>Copy the phone number and pay through Bizum using your bank app.</Trans>
        </p>
      ) : null}
      <p className="wrap-anywhere whitespace-pre-wrap select-text">{details}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("payment_link_requested")}
          className="bg-accent-500 text-accent-50 dark:bg-accent-500 dark:text-accent-50 flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Icon icon="lucide.external-link" width={20} height={20} />
          <Trans>Open {methodName}</Trans>
        </a>
      ) : null}
      <Button color="input-like" className="min-h-11" pressAction={copyDetails}>
        <Icon icon="lucide.copy" width={20} height={20} className="mr-2" />
        <Trans>Copy details</Trans>
      </Button>
    </section>
  );
}
