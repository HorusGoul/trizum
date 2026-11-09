import { useEffect, useRef, useState } from "react";
import { t } from "@lingui/core/macro";
import { toast } from "sonner";
import { trizumApiClient } from "#src/lib/trizumApiClient.ts";
import type { Receipt } from "#src/lib/api/receiptContract.ts";
import type { ReceiptDraftValues } from "#src/lib/receiptSuggestions.ts";
import { trackEvent } from "#src/lib/analytics.ts";

export interface ReceiptImage {
  photoId: string;
  image: string;
}

interface ReceiptResult {
  context: string;
  photoId: string;
  receipt: Receipt;
  baseline: ReceiptDraftValues;
}

export function useReceiptSuggestions({
  partyId,
  userId,
  isBoosted,
  photoIds,
  getValues,
  getPhotoIds,
  services = { analyzeReceipt: trizumApiClient.premium.analyzeReceipt, trackEvent },
}: {
  partyId: string;
  userId: string | undefined;
  isBoosted: boolean;
  photoIds: string[];
  getValues: () => ReceiptDraftValues;
  getPhotoIds: () => string[];
  services?: {
    analyzeReceipt: typeof trizumApiClient.premium.analyzeReceipt;
    trackEvent: typeof trackEvent;
  };
}) {
  const context = JSON.stringify([partyId, userId, isBoosted]);
  const [results, setResults] = useState<ReceiptResult[]>([]);
  const [requests] = useState(() => new Map<AbortController, string | number>());
  const activeContext = useRef<{ key: string } | null>(null);
  useEffect(() => {
    activeContext.current = { key: context };

    return () => {
      activeContext.current = null;

      for (const [request, toastId] of requests) {
        request.abort();
        toast.dismiss(toastId);
      }

      requests.clear();
    };
  }, [context, requests]);

  function analyze(images: ReceiptImage[]) {
    const requestContext = activeContext.current;

    if (!isBoosted || !userId || requestContext?.key !== context) return;
    const baseline = { ...getValues() };

    for (const { photoId, image } of images) {
      const controller = new AbortController();
      const toastId = toast.loading(t`Reading receipt for Premium suggestions…`);
      requests.set(controller, toastId);
      void services
        .analyzeReceipt(
          partyId,
          image,
          AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]),
        )
        .then((receipt) => {
          if (
            controller.signal.aborted ||
            activeContext.current !== requestContext ||
            !getPhotoIds().includes(photoId)
          )
            return;
          setResults((current) => [...current, { context, photoId, receipt, baseline }]);
        })
        .catch(() => {
          if (
            !controller.signal.aborted &&
            activeContext.current === requestContext &&
            getPhotoIds().includes(photoId)
          ) {
            toast.error(t`Could not read this receipt. You can still enter the expense yourself.`);
          }
        })
        .finally(() => {
          requests.delete(controller);
          toast.dismiss(toastId);
        });
    }
  }

  const result = results.find(
    (result) => result.context === context && photoIds.includes(result.photoId),
  );

  function dismiss(accepted: boolean) {
    if (!result) return;
    setResults((current) => current.filter((entry) => entry !== result));
    services.trackEvent(
      accepted ? "receipt_suggestions_accepted" : "receipt_suggestions_discarded",
    );
  }

  return { analyze, result, dismiss };
}
