import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useEffect, useState } from "react";
import { Dialog, Modal, ModalOverlay } from "react-aria-components";
import { APP_WORKER_FULL_RESTART_REQUIRED_EVENT } from "#src/lib/appWorker/client.ts";
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.tsx";
import { cn } from "#src/ui/utils.ts";

export function AppRecoveryDialog() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function handleFullRestartRequired() {
      setIsOpen(true);
    }

    window.addEventListener(APP_WORKER_FULL_RESTART_REQUIRED_EVENT, handleFullRestartRequired);

    return () => {
      window.removeEventListener(APP_WORKER_FULL_RESTART_REQUIRED_EVENT, handleFullRestartRequired);
    };
  }, []);

  return (
    <ModalOverlay
      isKeyboardDismissDisabled
      isOpen={isOpen}
      className={({ isEntering, isExiting }) =>
        cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-accent-950/45 px-safe-or-4 py-safe-offset-6 backdrop-blur-md",
          isEntering && "duration-200 ease-out animate-in fade-in",
          isExiting && "duration-150 ease-in animate-out fade-out",
        )
      }
    >
      <Modal
        className={({ isEntering, isExiting }) =>
          cn(
            "w-full max-w-[420px] outline-none",
            isEntering && "duration-200 ease-out animate-in fade-in zoom-in-95",
            isExiting && "duration-150 ease-in animate-out fade-out zoom-out-95",
          )
        }
      >
        <Dialog
          aria-label={t`Restart trizum`}
          className="border-accent-200 dark:border-accent-800 dark:bg-accent-950 rounded-lg border bg-white shadow-2xl outline-none"
        >
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex flex-col gap-3">
              <span className="bg-danger-50 text-danger-600 dark:bg-danger-950/50 dark:text-danger-300 flex size-10 items-center justify-center rounded-full">
                <Icon icon="lucide.circle-alert" width={20} height={20} />
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-medium">
                  <Trans>Restart trizum</Trans>
                </h2>
                <p className="text-accent-700 dark:text-accent-50 text-sm">
                  <Trans>
                    Something is not working properly. Restart trizum to recover. If this keeps
                    happening, check for updates or contact support.
                  </Trans>
                </p>
              </div>
            </div>

            <Button
              className="font-semibold"
              color="accent"
              onPress={() => window.location.reload()}
              type="button"
            >
              <span className="flex items-center gap-2">
                <Icon icon="lucide.refresh-cw" width={18} height={18} />
                <Trans>Restart app</Trans>
              </span>
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
