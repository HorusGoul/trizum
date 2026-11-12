import { useEffect, useRef, useState } from "react";
import { trizumApiClient } from "#src/lib/trizumApiClient.ts";
import type { Receipt } from "#src/lib/api/receiptContract.ts";
import {
  getReceiptSuggestions,
  hasReceiptSuggestions,
  type ReceiptDraftValues,
} from "#src/lib/receiptSuggestions.ts";
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

interface ScanningReceipt {
  context: string;
  photoId: string;
  controller: AbortController;
}

export function useReceiptSuggestions({
  partyId,
  userId,
  isBoosted,
  partyCurrency,
  current,
  photoIds,
  getValues,
  getPhotoIds,
  services = { analyzeReceipt: trizumApiClient.premium.analyzeReceipt, trackEvent },
}: {
  partyId: string;
  userId: string | undefined;
  isBoosted: boolean;
  partyCurrency: string;
  current: ReceiptDraftValues;
  photoIds: string[];
  getValues: () => ReceiptDraftValues;
  getPhotoIds: () => string[];
  services?: {
    analyzeReceipt: typeof trizumApiClient.premium.analyzeReceipt;
    trackEvent: typeof trackEvent;
  };
}) {
  const context = JSON.stringify([partyId, userId, isBoosted, partyCurrency, current.currency]);
  const [results, setResults] = useState<ReceiptResult[]>([]);
  const [scanning, setScanning] = useState<ScanningReceipt[]>([]);
  const [requests] = useState(() => new Map<AbortController, ReturnType<typeof setTimeout>>());
  const activeContext = useRef<{ key: string } | null>(null);
  useEffect(() => {
    activeContext.current = { key: context };

    return () => {
      activeContext.current = null;

      for (const [controller, timeoutId] of requests) {
        clearTimeout(timeoutId);
        controller.abort();
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

      function finishScanning() {
        if (activeContext.current === requestContext) {
          setScanning((current) => current.filter((entry) => entry.controller !== controller));
        }
      }

      const timeoutId = setTimeout(() => {
        controller.abort();
        requests.delete(controller);
        finishScanning();
      }, 60_000);

      requests.set(controller, timeoutId);
      setScanning((current) => [...current, { context, photoId, controller }]);
      void services
        .analyzeReceipt(partyId, image, controller.signal, { includeItems: false })
        .catch(() => null)
        .then((receipt) => {
          if (
            receipt === null ||
            (receipt.titleSuggestions.length === 0 &&
              receipt.merchantName === null &&
              receipt.total === null &&
              receipt.currency === null) ||
            controller.signal.aborted ||
            activeContext.current !== requestContext ||
            !getPhotoIds().includes(photoId)
          )
            return;

          const suggestions = getReceiptSuggestions({
            receipt,
            partyCurrency,
            current: getValues(),
            baseline,
          });

          if (!hasReceiptSuggestions(suggestions)) return;
          setResults((current) => [...current, { context, photoId, receipt, baseline }]);
        })
        .finally(() => {
          clearTimeout(timeoutId);
          requests.delete(controller);
          finishScanning();
        });
    }
  }

  const result = results.find((entry) => {
    if (entry.context !== context || !photoIds.includes(entry.photoId)) return false;

    const suggestions = getReceiptSuggestions({
      receipt: entry.receipt,
      partyCurrency,
      current,
      baseline: entry.baseline,
    });

    return hasReceiptSuggestions(suggestions);
  });

  const suggestions = result
    ? getReceiptSuggestions({
        receipt: result.receipt,
        partyCurrency,
        current,
        baseline: result.baseline,
      })
    : undefined;

  function dismiss(accepted: boolean) {
    if (!result) return;
    setResults((current) => current.filter((entry) => entry !== result));
    services.trackEvent(
      accepted ? "receipt_suggestions_accepted" : "receipt_suggestions_discarded",
    );
  }

  const scanningPhotoIds = scanning.flatMap((entry) =>
    entry.context === context && photoIds.includes(entry.photoId) ? [entry.photoId] : [],
  );

  return { analyze, result, suggestions, dismiss, scanningPhotoIds };
}
