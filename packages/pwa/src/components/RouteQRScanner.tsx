import { Trans } from "@lingui/react/macro";
import { Modal, ModalOverlay } from "react-aria-components";
import { QRCodeScanner, type ScanResult } from "./QRCodeScanner.js";
import { IconButton } from "#src/ui/IconButton.js";
import { t } from "@lingui/core/macro";
import { toast } from "sonner";

export interface RouteQRScannerProps {
  /** Whether the scanner is open */
  isOpen: boolean;
  /** Called when a QR code is successfully scanned */
  onScan: (value: string) => void;
  /** Called when the scanner should close */
  onClose: () => void;
}

/**
 * A QR scanner component designed to be used with route search params.
 * Renders as a fullscreen modal overlay with camera viewfinder.
 */
export function RouteQRScanner({
  isOpen,
  onScan,
  onClose,
}: RouteQRScannerProps) {
  function handleResult(result: ScanResult) {
    if (result.type === "cancelled") {
      onClose();
      return;
    }

    if (result.type === "error") {
      toast.error(result.message);
      onClose();
      return;
    }

    onScan(result.value);
  }

  return (
    <ModalOverlay
      isOpen={isOpen}
      isDismissable
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className={({ isEntering, isExiting }) =>
        `fixed inset-0 z-50 bg-black ${isEntering ? "duration-200 ease-out animate-in fade-in" : ""} ${isExiting ? "duration-150 ease-in animate-out fade-out" : ""}`
      }
    >
      <Modal className="h-full w-full">
        <div className="flex h-full flex-col">
          <div className="container absolute z-10 flex h-16 items-center px-2 mt-safe">
            <IconButton
              icon="#lucide/x"
              aria-label={t`Close`}
              className="flex-shrink-0 text-white"
              onPress={onClose}
            />

            <h1 className="max-h-12 truncate px-4 text-xl font-medium text-white drop-shadow-md">
              <Trans>Scan QR code</Trans>
            </h1>
          </div>

          <QRCodeScanner onResult={handleResult} />
        </div>
      </Modal>
    </ModalOverlay>
  );
}
