import { Trans } from "@lingui/react/macro";
import { Icon } from "@trizum/ui/Icon";

export function CashItem() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Icon
        icon="lucide.banknote"
        width={20}
        height={20}
        className="mt-1 shrink-0 text-neutral-600 dark:text-neutral-400"
      />
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-semibold">
          <Trans>Cash or other ways</Trans>
        </h3>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          <Trans>
            Get in touch with the person to make the payment in cash or a different way outside of
            the ones described above.
          </Trans>
        </p>
      </div>
    </div>
  );
}
