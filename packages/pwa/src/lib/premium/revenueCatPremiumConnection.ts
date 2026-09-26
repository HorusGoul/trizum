import type { CustomerInfo, PurchasesCallbackId } from "@revenuecat/purchases-capacitor";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

const REFRESH_INTERVAL_MS = 60_000;

interface RevenueCatPremiumConnectionOptions {
  addListener: (listener: (customerInfo: CustomerInfo) => void) => Promise<PurchasesCallbackId>;
  onCustomerInfo: (customerInfo: CustomerInfo) => void;
  onListenerError: (error: unknown) => void;
  onRefreshError: (error: unknown) => void;
  prepare: () => Promise<CustomerInfo | undefined>;
  refresh: () => Promise<CustomerInfo>;
  removeListener: (listenerId: PurchasesCallbackId) => Promise<void>;
}

export function connectRevenueCatPremium({
  addListener,
  onCustomerInfo,
  onListenerError,
  onRefreshError,
  prepare,
  refresh,
  removeListener,
}: RevenueCatPremiumConnectionOptions) {
  let active = true;
  let connectionAttempt: Promise<void> | undefined;
  let listenerId: PurchasesCallbackId | undefined;
  let listenerRegistration: Promise<void> | undefined;
  let appActive = true;

  function update(customerInfo: CustomerInfo) {
    if (active) {
      onCustomerInfo(customerInfo);
    }
  }

  function registerListener() {
    if (!active || listenerId || listenerRegistration) {
      return;
    }

    listenerRegistration = addListener(update)
      .then(async (registeredListenerId) => {
        if (active) {
          listenerId = registeredListenerId;
          return;
        }

        await removeListener(registeredListenerId);
      })
      .catch(onListenerError)
      .finally(() => {
        listenerRegistration = undefined;
      });
  }

  async function connect() {
    try {
      const customerInfo = await prepare();
      if (customerInfo) {
        update(customerInfo);
      }

      if (!active) {
        return;
      }

      registerListener();
      update(await refresh());
    } catch (error) {
      if (active) {
        onRefreshError(error);
      }
    }
  }

  function reconnect() {
    if (!active || connectionAttempt) {
      return;
    }

    connectionAttempt = connect().finally(() => {
      connectionAttempt = undefined;
    });
  }

  function refreshWhileActive() {
    if (appActive && document.visibilityState === "visible" && navigator.onLine) {
      reconnect();
    }
  }

  // CustomerInfo listeners do not receive server pushes. Ask the SDK regularly;
  // its cache controls network frequency and remains usable during offline startup.
  const refreshTimer = setInterval(refreshWhileActive, REFRESH_INTERVAL_MS);
  window.addEventListener("online", refreshWhileActive);
  document.addEventListener("visibilitychange", refreshWhileActive);
  const appStateListener = Capacitor.isNativePlatform()
    ? App.addListener("appStateChange", ({ isActive }) => {
        appActive = isActive;
        refreshWhileActive();
      })
    : undefined;
  void appStateListener?.catch(onListenerError);

  reconnect();

  return {
    disconnect() {
      active = false;
      clearInterval(refreshTimer);
      window.removeEventListener("online", refreshWhileActive);
      document.removeEventListener("visibilitychange", refreshWhileActive);
      void appStateListener?.then((handle) => handle.remove()).catch(onListenerError);
      if (listenerId) {
        void removeListener(listenerId).catch(onListenerError);
        listenerId = undefined;
      }
    },
    reconnect,
  };
}
