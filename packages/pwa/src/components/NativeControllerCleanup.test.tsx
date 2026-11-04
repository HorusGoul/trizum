// @vitest-environment jsdom

import type { PluginListenerHandle } from "@capacitor/core";
import type * as CapacitorCore from "@capacitor/core";
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { AdvertisingController } from "./AdvertisingController.tsx";
import { UpdateControllerNative } from "./UpdateControllerNative.tsx";
import { AdEntitlementContext } from "#src/lib/advertising/AdEntitlementContext.tsx";
import type { AdvertisingCoordinator as Coordinator } from "#src/lib/advertising/AdvertisingCoordinator.ts";
import type { createAdMobSdk } from "#src/lib/advertising/adMobSdk.ts";
import type {
  getNativeAppUpdateState,
  resumeNativeAppUpdate,
  performNativeAppUpdate,
} from "#src/lib/nativeAppUpdate.ts";

const addListener = vi.hoisted(() => vi.fn<() => Promise<PluginListenerHandle>>());

const coordinators = vi.hoisted(
  (): {
    destroy: ReturnType<typeof vi.fn>;
    setProtectedFlow: ReturnType<typeof vi.fn>;
    setEntitlement: ReturnType<typeof vi.fn>;
  }[] => [],
);

vi.mock("@capacitor/app", () => ({ App: { addListener } }));

vi.mock("@capacitor/core", async (importOriginal) => ({
  ...(await importOriginal<typeof CapacitorCore>()),
  Capacitor: { getPlatform: () => "android", isNativePlatform: () => true },
}));

vi.mock("#src/lib/advertising/adMobSdk.ts", () => ({
  createAdMobSdk: vi.fn<typeof createAdMobSdk>(),
}));

vi.mock("#src/lib/nativeAppUpdate.ts", () => ({
  getNativeAppUpdateState: vi
    .fn<typeof getNativeAppUpdateState>()
    .mockResolvedValue({ isUpdateAvailable: false }),
  resumeNativeAppUpdate: vi
    .fn<typeof resumeNativeAppUpdate>()
    .mockResolvedValue({ status: "unavailable" }),
  performNativeAppUpdate: vi
    .fn<typeof performNativeAppUpdate>()
    .mockResolvedValue({ status: "unavailable" }),
}));

vi.mock("#src/lib/advertising/AdvertisingCoordinator.ts", () => ({
  AdvertisingCoordinator: class {
    destroy = vi.fn<Coordinator["destroy"]>().mockResolvedValue(undefined);
    setEntitlement = vi.fn<Coordinator["setEntitlement"]>().mockResolvedValue(undefined);
    setProtectedFlow = vi.fn<Coordinator["setProtectedFlow"]>();
    markInteractive = vi.fn<Coordinator["markInteractive"]>();
    onActive = vi.fn<Coordinator["onActive"]>().mockResolvedValue(undefined);
    onInactive = vi.fn<Coordinator["onInactive"]>();

    constructor() {
      coordinators.push(this);
    }
  },
}));

let root: Root;
let unmounted: boolean;

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

async function render(kind: "updates" | "advertising", strict = false) {
  const controller =
    kind === "updates" ? (
      <UpdateControllerNative>{null}</UpdateControllerNative>
    ) : (
      <AdEntitlementContext value="adFree">
        <AdvertisingController protectedFlow>{null}</AdvertisingController>
      </AdEntitlementContext>
    );

  await act(async () => root.render(strict ? <StrictMode>{controller}</StrictMode> : controller));
}

async function unmount() {
  await act(async () => root.unmount());
  unmounted = true;
}

beforeEach(() => {
  vi.clearAllMocks();
  coordinators.length = 0;
  addListener.mockReset();
  // SAFETY: React reads this optional test-only flag from the global object; production globals do not declare it.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("requestAnimationFrame", vi.fn<typeof requestAnimationFrame>().mockReturnValue(42));
  vi.stubGlobal("cancelAnimationFrame", vi.fn<typeof cancelAnimationFrame>());
  root = createRoot(document.createElement("div"));
  unmounted = false;
});

afterEach(async () => {
  if (!unmounted) await unmount();
  vi.unstubAllGlobals();
});

it.each([
  ["updates", false],
  ["updates", true],
  ["advertising", false],
  ["advertising", true],
] as const)(
  "removes the %s listener when registration resolves after unmount: %s",
  async (kind, late) => {
    const registration = deferred<PluginListenerHandle>();
    const remove = vi.fn<PluginListenerHandle["remove"]>().mockResolvedValue(undefined);
    addListener.mockReturnValue(registration.promise);
    await render(kind);
    expect(addListener).toHaveBeenCalledOnce();

    if (!late) await act(async () => registration.resolve({ remove }));
    expect(remove).not.toHaveBeenCalled();

    await unmount();
    expect(vi.mocked(cancelAnimationFrame).mock.calls).toEqual(
      kind === "advertising" ? [[42]] : [],
    );
    expect(
      coordinators.map((coordinator) => ({
        destroyed: coordinator.destroy.mock.calls.length,
        protected: coordinator.setProtectedFlow.mock.calls.some(([value]) => value === true),
        adFree: coordinator.setEntitlement.mock.calls.some(([value]) => value === "adFree"),
      })),
    ).toEqual(kind === "advertising" ? [{ destroyed: 1, protected: true, adFree: true }] : []);
    expect(remove).toHaveBeenCalledTimes(late ? 0 : 1);

    if (late) await act(async () => registration.resolve({ remove }));
    expect(remove).toHaveBeenCalledOnce();
  },
);

it.each(["updates", "advertising"] as const)(
  "cleans up both %s registrations across StrictMode replay",
  async (kind) => {
    const first = deferred<PluginListenerHandle>();
    const second = deferred<PluginListenerHandle>();
    const removeFirst = vi.fn<PluginListenerHandle["remove"]>().mockResolvedValue(undefined);
    const removeSecond = vi.fn<PluginListenerHandle["remove"]>().mockResolvedValue(undefined);
    addListener.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await render(kind, true);
    expect(addListener).toHaveBeenCalledTimes(2);
    await act(async () => {
      first.resolve({ remove: removeFirst });
      second.resolve({ remove: removeSecond });
    });
    expect(removeFirst).toHaveBeenCalledOnce();
    expect(removeSecond).not.toHaveBeenCalled();
    await unmount();
    expect(removeFirst).toHaveBeenCalledOnce();
    expect(removeSecond).toHaveBeenCalledOnce();
    expect(coordinators.map((coordinator) => coordinator.destroy.mock.calls.length)).toEqual(
      kind === "advertising" ? [1, 1] : [],
    );
  },
);
