import { Trans } from "@lingui/react/macro";
import { Icon } from "@trizum/ui/Icon";

export function CashItem() {
  return (
    <div className="text-accent-700 dark:text-accent-300 flex flex-col gap-1 px-4 py-2">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <Icon icon="lucide.banknote" className="shrink-0" />
        <Trans>Cash or other ways</Trans>
      </h3>
      <p className="text-sm">
        <Trans>
          Get in touch with the person to make the payment in cash or a different way outside of the
          ones described above.
        </Trans>
      </p>
    </div>
  );
}
