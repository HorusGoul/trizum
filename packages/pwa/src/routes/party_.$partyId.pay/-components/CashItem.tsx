import { Trans } from "@lingui/react/macro";
import { Icon } from "@trizum/ui/Icon";

export function CashItem() {
  return (
    <div className="dark:bg-accent-900 flex flex-col gap-2 rounded-xl bg-white p-4">
      <h3 className="flex items-center gap-3 text-lg font-semibold">
        <Icon icon="lucide.banknote" className="shrink-0" />
        <Trans>Cash or other ways</Trans>
      </h3>
      <p className="text-accent-700 dark:text-accent-300">
        <Trans>
          Get in touch with the person to make the payment in cash or a different way outside of the
          ones described above.
        </Trans>
      </p>
    </div>
  );
}
