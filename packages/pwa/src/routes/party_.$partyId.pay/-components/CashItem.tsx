import { Trans } from "@lingui/react/macro";
import { Icon } from "@trizum/ui/Icon";

export function CashItem() {
  return (
    <div className="dark:bg-accent-900 flex items-start gap-3 bg-white px-4 py-3 first:rounded-t-xl last:rounded-b-xl">
      <Icon
        icon="lucide.banknote"
        width={20}
        height={20}
        className="text-accent-700 dark:text-accent-200 mt-1 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-semibold">
          <Trans>Cash or other ways</Trans>
        </h3>
        <p className="text-accent-600 dark:text-accent-400 mt-1 text-sm">
          <Trans>
            Get in touch with the person to make the payment in cash or a different way outside of
            the ones described above.
          </Trans>
        </p>
      </div>
    </div>
  );
}
