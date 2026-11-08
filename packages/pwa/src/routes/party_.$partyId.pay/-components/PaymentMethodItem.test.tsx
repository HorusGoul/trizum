// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { toast } from "sonner";
import { PwaUIProvider } from "#src/components/PwaUIProvider.tsx";
import * as analytics from "#src/lib/analytics.ts";
import { PaymentMethodItem } from "./PaymentMethodItem.tsx";

const writeText = vi.fn<(value: string) => Promise<void>>();
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  i18n.load("en", {});
  i18n.activate("en");
  vi.spyOn(analytics, "trackEvent").mockImplementation(() => undefined);
  vi.spyOn(toast, "success").mockReturnValue("success");
  vi.spyOn(toast, "error").mockReturnValue("error");
  writeText.mockReset().mockResolvedValue();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  // SAFETY: React uses this optional test-only flag to check act boundaries.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();

  if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  else Reflect.deleteProperty(navigator, "clipboard");
  vi.restoreAllMocks();
});

async function renderMethod(props: ComponentProps<typeof PaymentMethodItem>) {
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <PwaUIProvider>
          <PaymentMethodItem {...props} />
        </PwaUIProvider>
      </I18nProvider>,
    ),
  );
}

it("copies multi-line instructions and records success only after the clipboard write", async () => {
  const details = "Account holder: Alice\nIBAN: ES00 1234";
  await renderMethod({ type: "bank-transfer", details });
  await act(async () => container.querySelector("button")!.click());
  expect(writeText).toHaveBeenCalledExactlyOnceWith(details);
  expect(analytics.trackEvent).toHaveBeenCalledExactlyOnceWith("payment_contact_copied");
  expect(toast.success).toHaveBeenCalledOnce();
});

it("leaves details selectable and does not count a rejected clipboard write", async () => {
  writeText.mockRejectedValue(new Error("Clipboard permission denied"));
  await renderMethod({ type: "other", details: "Use Wise: alice@example.com" });
  await act(async () => container.querySelector("button")!.click());
  expect(analytics.trackEvent).not.toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalledOnce();
  expect(container.textContent).toContain("Use Wise: alice@example.com");
});

it("records opening a provider link without recording a settlement", async () => {
  await renderMethod({ type: "venmo", details: "@alice" });
  const link = container.querySelector("a")!;
  expect(link.href).toBe("https://venmo.com/u/alice");
  link.addEventListener("click", (event) => event.preventDefault());
  await act(async () => link.click());
  expect(analytics.trackEvent).toHaveBeenCalledExactlyOnceWith("payment_link_requested");
});

it("does not turn custom instructions into executable links", async () => {
  await renderMethod({ type: "other", details: "javascript:alert(1)" });
  expect(container.querySelector("a")).toBeNull();
  expect(container.textContent).toContain("javascript:alert(1)");
});
