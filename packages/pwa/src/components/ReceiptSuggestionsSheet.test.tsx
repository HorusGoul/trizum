// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { PwaUIProvider } from "./PwaUIProvider";
import { ReceiptSuggestionsSheet } from "./ReceiptSuggestionsSheet";
import type { ReceiptDraftValues } from "#src/lib/receiptSuggestions.ts";

let root: Root;
let container: HTMLDivElement;
const onAccept = vi.fn<(values: Partial<ReceiptDraftValues>) => void>();
const onDiscard = vi.fn<() => void>();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  onAccept.mockReset();
  onDiscard.mockReset();
  i18n.load("en", {});
  i18n.activate("en");
  // SAFETY: React's test-only act flag is not part of the production global type.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  await act(async () => vi.runAllTimersAsync());
  vi.useRealTimers();
  container.remove();
  vi.unstubAllGlobals();
});

async function render(currencyMismatch = false) {
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <PwaUIProvider>
          <ReceiptSuggestionsSheet
            receipt={{
              merchantName: "Market",
              titleSuggestions: [],
              total: "12.34",
              currency: currencyMismatch ? "USD" : "EUR",
              items: [],
            }}
            suggestions={{
              name: "Market",
              amount: currencyMismatch ? undefined : 12.34,
              currencyMismatch,
            }}
            onAccept={onAccept}
            onDiscard={onDiscard}
          />
        </PwaUIProvider>
      </I18nProvider>,
    ),
  );
  // Let the sheet's frame-delayed entrance settle while its container exists.
  await act(async () => vi.runAllTimersAsync());
}

function button(text: string) {
  const match = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );

  if (!match) throw new Error(`Missing button ${text}`);

  return match;
}

test("accepts title and total only after the user confirms", async () => {
  await render();
  expect(onAccept).not.toHaveBeenCalled();
  await act(async () => button("Accept suggestions").click());
  expect(onAccept).toHaveBeenCalledExactlyOnceWith({ name: "Market", amount: 12.34 });
});

test("settles sheet timers before the test document is disposed", async () => {
  await render();
  await act(async () => root.render(null));
  await act(async () => vi.runAllTimersAsync());
  expect(vi.getTimerCount()).toBe(0);
});

test("can accept only the total and disable acceptance with no fields selected", async () => {
  await render();
  const checkboxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  await act(async () => checkboxes[0].click());
  await act(async () => button("Accept suggestions").click());
  expect(onAccept).toHaveBeenCalledExactlyOnceWith({ amount: 12.34 });
  await act(async () => checkboxes[1].click());
  expect(button("Accept suggestions").disabled).toBe(true);
});

test("discards without applying any fields", async () => {
  await render();
  await act(async () => button("Discard").click());
  expect(onDiscard).toHaveBeenCalledOnce();
  expect(onAccept).not.toHaveBeenCalled();
});

test("offers only the title when the receipt currency differs", async () => {
  await render(true);
  expect(document.body.textContent).toContain("The receipt currency differs");
  await act(async () => button("Accept suggestions").click());
  expect(onAccept).toHaveBeenCalledExactlyOnceWith({ name: "Market" });
});
