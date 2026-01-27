import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";
import { guardParticipatingInParty } from "#src/lib/guards.js";
import {
  ReceiptScanner,
  type ReceiptScanResult,
} from "#src/components/ReceiptScanner.js";
import { parseReceiptDate } from "#src/lib/receiptExtraction.js";
import { BackButton } from "#src/components/BackButton.js";
import { toast } from "sonner";

export const Route = createFileRoute("/party_/$partyId/scan-receipt")({
  component: ScanReceipt,
  pendingComponent: PartyPendingComponent,

  async loader({ context, params, location }) {
    await guardParticipatingInParty(params.partyId, context, location);
  },
});

function ScanReceipt() {
  const { partyId } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const { history } = useRouter();

  function handleResult(result: ReceiptScanResult) {
    if (result.type === "cancelled") {
      history.back();
      return;
    }

    if (result.type === "error") {
      toast.error(result.message);
      history.back();
      return;
    }

    // Navigate to add expense with pre-filled data
    const { data } = result;

    // Build search params for pre-filling the expense form
    const searchParams: Record<string, string> = {};

    if (data.merchant) {
      searchParams.name = data.merchant;
    }

    if (data.total !== null) {
      searchParams.amount = data.total.toString();
    }

    if (data.date) {
      const parsedDate = parseReceiptDate(data.date);
      if (parsedDate) {
        searchParams.date = parsedDate.toISOString();
      }
    }

    toast.success(t`Receipt scanned successfully`);

    void navigate({
      to: "/party/$partyId/add",
      params: { partyId },
      search: searchParams,
      replace: true,
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="container absolute left-0 right-0 top-0 z-10 flex h-16 items-center px-2 mt-safe">
        <BackButton fallbackOptions={{ to: "/party/$partyId" }} />
        <h1 className="truncate px-4 text-xl font-medium text-white drop-shadow-md">
          <Trans>Scan Receipt</Trans>
        </h1>
      </div>
      <ReceiptScanner onResult={handleResult} />
    </div>
  );
}
