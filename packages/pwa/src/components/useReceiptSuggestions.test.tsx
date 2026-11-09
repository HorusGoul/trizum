// @vitest-environment jsdom
import { act, useEffect, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { i18n } from "@lingui/core";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { toast } from "sonner";
import type { ReceiptDraftValues } from "#src/lib/receiptSuggestions.ts";
import type { Receipt } from "#src/lib/api/receiptContract.ts";
import { useReceiptSuggestions } from "./useReceiptSuggestions";

const receipt: Receipt = {
  merchantName: "Market",
  titleSuggestions: [],
  total: "12.34",
  currency: "EUR",
  items: [],
};

const analyzeReceipt =
  vi.fn<NonNullable<Parameters<typeof useReceiptSuggestions>[0]["services"]>["analyzeReceipt"]>();

const trackEvent =
  vi.fn<NonNullable<Parameters<typeof useReceiptSuggestions>[0]["services"]>["trackEvent"]>();

const services = { analyzeReceipt, trackEvent };
let root: Root;
let container: HTMLDivElement;
let photoIds: string[];
let draft: ReceiptDraftValues;
let controller: ReturnType<typeof useReceiptSuggestions>;

function Harness({
  userId = "member",
  isBoosted = true,
}: {
  userId?: string;
  isBoosted?: boolean;
}) {
  const suggestions = useReceiptSuggestions({
    partyId: "party",
    userId,
    isBoosted,
    photoIds,
    getPhotoIds: () => photoIds,
    getValues: () => draft,
    services,
  });

  useEffect(() => {
    controller = suggestions;
  }, [suggestions]);

  return <output>{suggestions.result?.receipt.merchantName}</output>;
}

async function render(props: ComponentProps<typeof Harness> = {}) {
  await act(async () =>
    root.render(<Harness key={JSON.stringify([props.userId, props.isBoosted])} {...props} />),
  );
}

beforeEach(() => {
  analyzeReceipt.mockReset();
  trackEvent.mockReset();
  vi.spyOn(toast, "loading").mockReturnValue("reading");
  vi.spyOn(toast, "dismiss").mockReturnValue("reading");
  vi.spyOn(toast, "error").mockReturnValue("error");
  i18n.load("en", {});
  i18n.activate("en");
  // SAFETY: React's test-only act flag is not part of the production global type.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  photoIds = ["photo"];
  draft = { name: "", amount: 0 };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("receipt suggestion lifecycle", () => {
  test("keeps each photo scanning until its own request settles", async () => {
    vi.useFakeTimers();
    const first = deferred<Receipt>();
    const second = deferred<Receipt>();
    analyzeReceipt.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    photoIds = ["photo", "other-photo"];
    await render();
    await act(async () =>
      controller.analyze([
        { photoId: "photo", image: "receipt" },
        { photoId: "other-photo", image: "other-receipt" },
      ]),
    );
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(controller.scanningPhotoIds).toEqual(["photo", "other-photo"]);
    await act(async () => first.resolve(receipt));
    expect(controller.scanningPhotoIds).toEqual(["other-photo"]);
    await act(async () => second.resolve(receipt));
    expect(controller.scanningPhotoIds).toEqual([]);
  });

  test("ends the scan on timeout even if the transport never settles", async () => {
    vi.useFakeTimers();
    analyzeReceipt.mockReturnValue(new Promise(() => {}));
    await render();
    await act(async () => controller.analyze([{ photoId: "photo", image: "receipt" }]));
    expect(controller.scanningPhotoIds).toEqual(["photo"]);
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(controller.scanningPhotoIds).toEqual([]);
    expect(controller.result).toBeUndefined();
    expect(toast.error).not.toHaveBeenCalled();
  });
  test("starts analysis without modern AbortSignal static methods", async () => {
    vi.stubGlobal("AbortSignal", { any: undefined, timeout: undefined });
    analyzeReceipt.mockResolvedValue(receipt);
    await render();
    await act(async () => controller.analyze([{ photoId: "photo", image: "receipt" }]));
    expect(controller.result?.receipt).toEqual(receipt);
    expect(toast.loading).not.toHaveBeenCalled();
    expect(toast.dismiss).not.toHaveBeenCalled();
  });
  test("stays silent when no receipt information could be extracted", async () => {
    analyzeReceipt.mockResolvedValue({
      merchantName: null,
      titleSuggestions: [],
      total: null,
      currency: null,
      items: [],
    });
    await render();
    await act(async () => controller.analyze([{ photoId: "photo", image: "receipt" }]));
    expect(controller.result).toBeUndefined();
    expect(toast.loading).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
  test("can suggest an activity title when the merchant and total are unreadable", async () => {
    analyzeReceipt.mockResolvedValue({
      merchantName: null,
      titleSuggestions: ["Coffee"],
      total: null,
      currency: null,
      items: [],
    });
    await render();
    await act(async () => controller.analyze([{ photoId: "photo", image: "receipt" }]));
    expect(controller.result?.receipt.titleSuggestions).toEqual(["Coffee"]);
    expect(toast.loading).not.toHaveBeenCalled();
  });
  test("times out analysis and clears its request timer", async () => {
    vi.useFakeTimers();
    analyzeReceipt.mockImplementation(
      (_partyId, _image, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    await render();
    await act(async () => controller.analyze([{ photoId: "photo", image: "receipt" }]));
    const signal = analyzeReceipt.mock.calls[0][2];
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(signal?.aborted).toBe(true);
    expect(controller.result).toBeUndefined();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.dismiss).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  test("keeps the draft unchanged until acceptance and records explicit decisions", async () => {
    analyzeReceipt.mockResolvedValue(receipt);
    await render();
    await act(async () => controller.analyze([{ photoId: "photo", image: "receipt" }]));
    expect(controller.result?.receipt).toEqual(receipt);
    expect(draft).toEqual({ name: "", amount: 0 });
    expect(trackEvent).not.toHaveBeenCalled();
    await act(async () => controller.dismiss(true));
    expect(controller.result).toBeUndefined();
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith("receipt_suggestions_accepted");
    await act(async () => controller.analyze([{ photoId: "photo", image: "receipt" }]));
    await act(async () => controller.dismiss(false));
    expect(trackEvent).toHaveBeenLastCalledWith("receipt_suggestions_discarded");
    expect(draft).toEqual({ name: "", amount: 0 });
  });
  test("does not request analysis for a party without Boost", async () => {
    await render({ isBoosted: false });
    await act(async () => controller.analyze([{ photoId: "photo", image: "receipt" }]));
    expect(analyzeReceipt).not.toHaveBeenCalled();
  });
  test("ignores results after a photo is removed", async () => {
    const pending = deferred<Receipt>();
    analyzeReceipt.mockReturnValue(pending.promise);
    await render();
    await act(async () => controller.analyze([{ photoId: "photo", image: "receipt" }]));
    photoIds = [];
    await render();
    expect(controller.scanningPhotoIds).toEqual([]);
    await act(async () => pending.resolve(receipt));
    expect(controller.result).toBeUndefined();
    expect(trackEvent).not.toHaveBeenCalled();
  });
  test("aborts and ignores late results after changing accounts", async () => {
    const pending = deferred<Receipt>();
    analyzeReceipt.mockReturnValue(pending.promise);
    await render();
    await act(async () => controller.analyze([{ photoId: "photo", image: "receipt" }]));
    const signal = analyzeReceipt.mock.calls[0][2];
    await render({ userId: "another-member" });
    expect(signal?.aborted).toBe(true);
    expect(controller.scanningPhotoIds).toEqual([]);
    await act(async () => pending.resolve(receipt));
    expect(controller.result).toBeUndefined();
    await render({ userId: "member" });
    expect(controller.result).toBeUndefined();
  });
  test("does not restore a completed suggestion after leaving and returning to the account", async () => {
    analyzeReceipt.mockResolvedValue(receipt);
    await render();
    await act(async () => controller.analyze([{ photoId: "photo", image: "receipt" }]));
    expect(controller.result).toBeDefined();
    await render({ userId: "another-member" });
    await render({ userId: "member" });
    expect(controller.result).toBeUndefined();
  });
  test("cleans up requests when the editor unmounts", async () => {
    const pending = deferred<Receipt>();
    analyzeReceipt.mockReturnValue(pending.promise);
    await render();
    await act(async () => controller.analyze([{ photoId: "photo", image: "receipt" }]));
    const signal = analyzeReceipt.mock.calls[0][2];
    await act(async () => root.render(null));
    expect(signal?.aborted).toBe(true);
    expect(toast.dismiss).not.toHaveBeenCalled();
    await act(async () => pending.resolve(receipt));
    expect(trackEvent).not.toHaveBeenCalled();
  });
  test("keeps attachments and draft usable on failure without logging receipt information", async () => {
    analyzeReceipt.mockRejectedValue(new Error("private receipt information"));
    await render();
    await act(async () => controller.analyze([{ photoId: "photo", image: "receipt" }]));
    expect(photoIds).toEqual(["photo"]);
    expect(draft).toEqual({ name: "", amount: 0 });
    expect(toast.error).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(controller.scanningPhotoIds).toEqual([]);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });

  return { promise, resolve };
}
