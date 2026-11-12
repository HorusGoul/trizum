// @vitest-environment jsdom
import { StrictMode, act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import {
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  type RouterHistory,
} from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { ModalSheet } from "@trizum/ui/ModalSheet";
import { PwaUIProvider } from "./PwaUIProvider";
import { ReceiptSuggestionsSheet } from "./ReceiptSuggestionsSheet";
import { createSheetNavigation } from "#src/lib/sheetNavigation.ts";

let root: Root;
let container: HTMLDivElement;
let history: RouterHistory;
let navigation: ReturnType<typeof createSheetNavigation>;
const onDiscard = vi.fn<() => void>();
const onAccept = vi.fn<() => void>();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  i18n.load("en", {});
  i18n.activate("en");
  onDiscard.mockReset();
  onAccept.mockReset();
  window.history.replaceState(null, "", "/party");
  navigation = createSheetNavigation(() => createBrowserHistory());
  history = navigation.history;
  history.push("/expense?calculator=amount");
  history.flush();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  await act(async () => vi.runAllTimersAsync());
  await navigation.destroy();
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function settle(action?: () => void) {
  await act(async () => {
    action?.();
    await vi.runAllTimersAsync();
  });
}

async function render(children: ReactNode) {
  await act(async () =>
    root.render(
      <StrictMode>
        <I18nProvider i18n={i18n}>
          <PwaUIProvider modalSheetNavigation={navigation}>{children}</PwaUIProvider>
        </I18nProvider>
      </StrictMode>,
    ),
  );
  await settle();
}

function ReceiptEditor() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <>
      <input aria-label="Expense draft" defaultValue="My handwritten title" />
      {isOpen ? (
        <ReceiptSuggestionsSheet
          partyCurrency="EUR"
          receipt={{
            merchantName: "Café",
            titleSuggestions: ["Cafés", "Coffee"],
            total: "15.70",
            currency: "EUR",
            currencyEvidence: null,
            currencyEvidenceSource: null,
            items: [],
          }}
          suggestions={{
            name: "Cafés",
            amount: 15.7,
            currencyMismatch: false,
            currency: undefined,
          }}
          onAccept={onAccept}
          onDiscard={() => {
            onDiscard();
            setIsOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function PartyPage() {
  return <p>Party page</p>;
}

function NestedSheets({
  onParentClose,
  locked = false,
}: {
  onParentClose: () => void;
  locked?: boolean;
}) {
  const [parentOpen, setParentOpen] = useState(true);
  const [childOpen, setChildOpen] = useState(true);

  return (
    <>
      <output>
        {parentOpen ? "parent open" : "parent closed"};{childOpen ? "child open" : "child closed"}
      </output>
      <ModalSheet
        aria-label="Parent sheet"
        isOpen={parentOpen}
        onOpenChange={(open) => {
          if (!open) onParentClose();
          setParentOpen(open);
        }}
      >
        <span>Parent content</span>
        <ModalSheet
          aria-label="Child sheet"
          isOpen={childOpen}
          isDismissable={!locked}
          onOpenChange={setChildOpen}
        >
          <span>Child content</span>
        </ModalSheet>
      </ModalSheet>
    </>
  );
}

test("Back discards receipt suggestions while preserving the editor, URL and draft", async () => {
  const rootRoute = createRootRoute();

  const partyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/party",
    component: PartyPage,
  });

  const editorRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/expense",
    component: ReceiptEditor,
  });

  const router = createRouter({
    history,
    routeTree: rootRoute.addChildren([partyRoute, editorRoute]),
    defaultStaleTime: Infinity,
  });

  await router.load();
  await render(<RouterProvider router={router} />);
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  const draft = document.querySelector<HTMLInputElement>('input[aria-label="Expense draft"]');

  if (!draft) throw new Error("Missing expense draft");
  draft.value = "Changed while reviewing the receipt";
  const length = history.length;
  await settle(() => window.history.back());
  await settle();
  expect(onDiscard).toHaveBeenCalledOnce();
  expect(onAccept).not.toHaveBeenCalled();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.querySelector('input[aria-label="Expense draft"]')).toBe(draft);
  expect(draft.value).toBe("Changed while reviewing the receipt");
  expect(history.location.href).toBe("/expense?calculator=amount");
  expect(window.location.pathname + window.location.search).toBe("/expense?calculator=amount");
  expect(router.state.location.href).toBe("/expense?calculator=amount");
  expect(history.length).toBe(length);
  await settle(() => window.history.back());
  expect(history.location.pathname).toBe("/party");
  expect(container.textContent).toContain("Party page");
});

test("Discard releases Back immediately without leaving a sheet history entry", async () => {
  await render(<ReceiptEditor />);

  const discard = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === "Discard",
  );

  if (!discard) throw new Error("Missing Discard button");
  await settle(() => discard.click());
  await settle(() => window.history.back());
  expect(history.location.pathname).toBe("/party");
  expect(onDiscard).toHaveBeenCalledOnce();
});

test("initially nested sheets close from the top and use the latest parent callback", async () => {
  const oldCallback = vi.fn<() => void>();
  const newCallback = vi.fn<() => void>();
  await render(<NestedSheets onParentClose={oldCallback} />);
  await render(<NestedSheets onParentClose={newCallback} />);
  await settle(() => window.history.back());
  expect(container.querySelector("output")?.textContent).toBe("parent open;child closed");
  expect(newCallback).not.toHaveBeenCalled();
  await settle(() => window.history.back());
  expect(container.querySelector("output")?.textContent).toBe("parent closed;child closed");
  expect(oldCallback).not.toHaveBeenCalled();
  expect(newCallback).toHaveBeenCalledOnce();
});

test("changing dismissibility keeps a locked top sheet ahead of its parent", async () => {
  const onParentClose = vi.fn<() => void>();
  await render(<NestedSheets onParentClose={onParentClose} />);
  await render(<NestedSheets onParentClose={onParentClose} locked />);
  await settle(() => window.history.back());
  expect(container.querySelector("output")?.textContent).toBe("parent open;child open");
  expect(onParentClose).not.toHaveBeenCalled();
  await render(<NestedSheets onParentClose={onParentClose} />);
  await settle(() => window.history.back());
  expect(container.querySelector("output")?.textContent).toBe("parent open;child closed");
  expect(onParentClose).not.toHaveBeenCalled();
});

test("direct-entry receipt sheets survive StrictMode registration and close on Back", async () => {
  await settle(() => window.history.back());
  expect(history.location.state.__TSR_index).toBe(0);
  await render(<ReceiptEditor />);
  expect(onDiscard).not.toHaveBeenCalled();
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  await settle(() => window.history.back());
  await settle();
  expect(onDiscard).toHaveBeenCalledOnce();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.querySelector<HTMLInputElement>('input[aria-label="Expense draft"]')?.value).toBe(
    "My handwritten title",
  );
});
