import { Trans } from "@lingui/react/macro";

export function CashItem() {
  return (
    <div className="dark:bg-accent-900 flex flex-col gap-2 rounded-xl bg-white p-4">
      <h3 className="text-lg font-semibold">
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
