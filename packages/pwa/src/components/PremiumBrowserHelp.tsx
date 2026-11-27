import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Dialog, Modal, ModalOverlay } from "react-aria-components";
import { IconButton } from "@trizum/ui/IconButton";

export function PremiumBrowserHelp({ onClose }: { onClose: () => void }) {
  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className="px-safe-or-4 py-safe-offset-6 fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/45 backdrop-blur-md"
    >
      <Modal className="w-full max-w-[420px] outline-hidden">
        <Dialog
          aria-label={t`trizum Premium`}
          className="relative rounded-2xl border border-neutral-200 bg-white p-6 text-neutral-950 shadow-2xl outline-hidden dark:border-neutral-800 dark:bg-black dark:text-neutral-50"
        >
          <IconButton
            icon="lucide.x"
            aria-label={t`Close Premium`}
            className="absolute top-2 right-2"
            onPress={onClose}
          />
          <h2 className="pr-8 text-lg font-bold">
            <Trans>Premium in the mobile app</Trans>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
            <Trans>
              Purchases and restores are available in the trizum app installed from the App Store or
              Google Play.
            </Trans>
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
            <li>
              <Trans>
                Open the installed trizum app and sign in to the account you want to use for
                Premium.
              </Trans>
            </li>
            <li>
              <Trans>
                Go to Settings → Premium to choose a plan, or use Restore purchases if you already
                redeemed your code.
              </Trans>
            </li>
          </ol>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
