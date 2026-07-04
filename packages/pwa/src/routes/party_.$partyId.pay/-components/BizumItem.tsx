import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { toast } from "sonner";
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.tsx";

export function BizumItem({ phoneNumber }: { phoneNumber: string }) {
  return (
    <div className="dark:bg-accent-900 flex flex-col gap-2 rounded-xl bg-white p-4">
      <h3 className="text-lg font-semibold">Bizum</h3>
      <p className="text-accent-700 dark:text-accent-300">
        <Trans>Copy the phone number and pay through Bizum using your bank app.</Trans>
      </p>
      <Button
        color="input-like"
        className="rounded-lg font-semibold"
        onPress={() => {
          navigator.clipboard
            .writeText(phoneNumber)
            .then(() => {
              toast.success(t`Phone number copied to clipboard!`);
            })
            .catch(() => {
              prompt(
                t`Failed to copy phone number to clipboard, please copy it manually`,
                phoneNumber,
              );
            });
        }}
      >
        <Icon icon="lucide.copy" width={20} height={20} />
        <span className="ml-2">{phoneNumber}</span>
      </Button>
    </div>
  );
}
