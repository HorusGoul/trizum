import type { PluginListenerHandle } from "@capacitor/core";
import type { CustomerInfo } from "@revenuecat/purchases-capacitor";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { connectRevenueCatPremium } from "./revenueCatPremiumConnection.ts";

const native = vi.hoisted(() => ({
  addListener:
    vi.fn<
      (
        event: "appStateChange",
        callback: (state: { isActive: boolean }) => void,
      ) => Promise<PluginListenerHandle>
    >(),
  isNativePlatform: vi.fn<() => boolean>(() => false),
}));
vi.mock("@capacitor/app", () => ({ App: { addListener: native.addListener } }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: native.isNativePlatform } }));

beforeEach(() => {
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  vi.stubGlobal("navigator", { onLine: true });
  native.isNativePlatform.mockReturnValue(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const customerInfo = { id: "premium" } as unknown as CustomerInfo;

describe("connectRevenueCatPremium", () => {
  it("subscribes even when the initial customer refresh fails", async () => {
    let listener: ((value: CustomerInfo) => void) | undefined;
    const onCustomerInfo = vi.fn<(value: CustomerInfo) => void>();
    const onRefreshError = vi.fn<(error: unknown) => void>();
    const connection = connectRevenueCatPremium({
      addListener: vi.fn<(registeredListener: (value: CustomerInfo) => void) => Promise<string>>(
        async (registeredListener) => {
          listener = registeredListener;
          return "listener";
        },
      ),
      onCustomerInfo,
      onListenerError: vi.fn<(error: unknown) => void>(),
      onRefreshError,
      prepare: vi.fn<() => Promise<CustomerInfo | undefined>>(async () => undefined),
      refresh: vi.fn<() => Promise<CustomerInfo>>(async () => {
        throw new Error("offline");
      }),
      removeListener: vi.fn<(listenerId: string) => Promise<void>>(async () => undefined),
    });

    await vi.waitFor(() => expect(onRefreshError).toHaveBeenCalledOnce());
    listener?.(customerInfo);
    expect(onCustomerInfo).toHaveBeenCalledWith(customerInfo);
    connection.disconnect();
  });

  it("retries RevenueCat setup on reconnect", async () => {
    const addListener = vi
      .fn<(listener: (value: CustomerInfo) => void) => Promise<string>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("listener");
    const prepare = vi
      .fn<() => Promise<CustomerInfo | undefined>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    const refresh = vi.fn<() => Promise<CustomerInfo>>().mockResolvedValue(customerInfo);
    const onCustomerInfo = vi.fn<(value: CustomerInfo) => void>();
    const onListenerError = vi.fn<(error: unknown) => void>();
    const onRefreshError = vi.fn<(error: unknown) => void>();
    const connection = connectRevenueCatPremium({
      addListener,
      onCustomerInfo,
      onListenerError,
      onRefreshError,
      prepare,
      refresh,
      removeListener: vi.fn<(listenerId: string) => Promise<void>>(async () => undefined),
    });

    await vi.waitFor(() => expect(onRefreshError).toHaveBeenCalledOnce());
    connection.reconnect();

    await vi.waitFor(() => expect(onCustomerInfo).toHaveBeenCalledWith(customerInfo));
    expect(addListener).toHaveBeenCalledOnce();
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledOnce();
    connection.disconnect();
  });
});

describe("foreground refresh", () => {
  const expiredInfo = { id: "free" } as unknown as CustomerInfo;

  function setup() {
    vi.useFakeTimers();
    const onCustomerInfo = vi.fn<(value: CustomerInfo) => void>();
    const onRefreshError = vi.fn<(error: unknown) => void>();
    const refresh = vi.fn<() => Promise<CustomerInfo>>().mockResolvedValue(customerInfo);
    const removeListener = vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined);
    const connection = connectRevenueCatPremium({
      addListener: vi
        .fn<(listener: (value: CustomerInfo) => void) => Promise<string>>()
        .mockResolvedValue("listener"),
      onCustomerInfo,
      onListenerError: vi.fn<(error: unknown) => void>(),
      onRefreshError,
      prepare: vi.fn<() => Promise<CustomerInfo | undefined>>().mockResolvedValue(undefined),
      refresh,
      removeListener,
    });
    return { connection, onCustomerInfo, onRefreshError, refresh, removeListener };
  }

  it("observes expiration without closing the app and leaves renewal decisions to the SDK", async () => {
    const { connection, onCustomerInfo, refresh } = setup();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onCustomerInfo).toHaveBeenLastCalledWith(customerInfo);
    refresh.mockResolvedValue(expiredInfo);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onCustomerInfo).toHaveBeenLastCalledWith(expiredInfo);
    connection.disconnect();
  });

  it("pauses polling while hidden or offline and refreshes on visibility and reconnection", async () => {
    const { connection, refresh } = setup();
    await vi.advanceTimersByTimeAsync(0);
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(2);
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(3);
    connection.disconnect();
  });

  it("still reads SDK cached information on an offline cold start", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    const { connection, onCustomerInfo, refresh } = setup();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(refresh).toHaveBeenCalledOnce();
    expect(onCustomerInfo).toHaveBeenLastCalledWith(customerInfo);
    connection.disconnect();
  });

  it("does not overlap requests and ignores an old account's result after disconnect", async () => {
    const { connection, refresh, onCustomerInfo, removeListener } = setup();
    await vi.advanceTimersByTimeAsync(0);
    let resolveRefresh!: (value: CustomerInfo) => void;
    refresh.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    await vi.advanceTimersByTimeAsync(60_000);
    window.dispatchEvent(new Event("online"));
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    connection.disconnect();
    resolveRefresh(expiredInfo);
    await vi.advanceTimersByTimeAsync(120_000);
    window.dispatchEvent(new Event("online"));
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(onCustomerInfo).toHaveBeenCalledTimes(1);
    expect(removeListener).toHaveBeenCalledWith("listener");
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("recovers on the next foreground poll after a transient error", async () => {
    const { connection, refresh, onCustomerInfo, onRefreshError } = setup();
    await vi.advanceTimersByTimeAsync(0);
    refresh.mockRejectedValueOnce(new Error("unreachable"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onRefreshError).toHaveBeenCalledOnce();
    refresh.mockResolvedValue(expiredInfo);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onCustomerInfo).toHaveBeenLastCalledWith(expiredInfo);
    connection.disconnect();
  });

  it("pauses during native inactivity, resumes immediately, and removes a late native listener", async () => {
    native.isNativePlatform.mockReturnValue(true);
    let onAppState!: (state: { isActive: boolean }) => void;
    let register!: (handle: { remove: () => Promise<void> }) => void;
    native.addListener.mockImplementation((_event, callback) => {
      onAppState = callback;
      return new Promise((resolve) => {
        register = resolve;
      });
    });
    const { connection, refresh } = setup();
    await vi.advanceTimersByTimeAsync(0);
    onAppState({ isActive: false });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(refresh).toHaveBeenCalledOnce();
    onAppState({ isActive: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(2);
    connection.disconnect();
    const remove = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    register({ remove });
    await vi.advanceTimersByTimeAsync(0);
    expect(remove).toHaveBeenCalledOnce();
    onAppState({ isActive: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
