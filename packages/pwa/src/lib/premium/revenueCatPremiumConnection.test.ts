import type { CustomerInfo } from "@revenuecat/purchases-capacitor";
import { describe, expect, it, vi } from "vite-plus/test";
import { connectRevenueCatPremium } from "./revenueCatPremiumConnection.ts";

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
