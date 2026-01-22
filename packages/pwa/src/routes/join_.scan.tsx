import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { BackButton } from "#src/components/BackButton.js";
import {
  QRCodeScanner,
  type ScanResult,
} from "#src/components/QRCodeScanner.js";
import { parseQRCodeForPartyId } from "#src/lib/qr.js";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/join_/scan")({
  component: JoinScan,
});

function JoinScan() {
  const navigate = useNavigate();

  function handleScanResult(result: ScanResult) {
    if (result.type === "cancelled") {
      // User cancelled, go back to join page
      void navigate({ to: "/join" });
      return;
    }

    if (result.type === "error") {
      // Error already shown via toast in the scanner
      void navigate({ to: "/join" });
      return;
    }

    // Parse the QR code value
    const partyId = parseQRCodeForPartyId(result.value);

    if (!partyId) {
      toast.error(
        t`Invalid QR code. This doesn't appear to be a trizum party code.`,
      );
      void navigate({ to: "/join" });
      return;
    }

    // Navigate to the party
    void navigate({
      to: "/party/$partyId",
      replace: true,
      params: { partyId },
      search: { tab: "expenses" },
    });
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="container absolute z-10 flex h-16 items-center px-2 mt-safe">
        <BackButton fallbackOptions={{ to: "/join" }} />

        <h1 className="max-h-12 truncate px-4 text-xl font-medium text-white drop-shadow-md">
          <Trans>Scan QR code</Trans>
        </h1>
      </div>

      <QRCodeScanner onResult={handleScanResult} />
    </div>
  );
}
