import type { CustomerInfo, PurchasesCallbackId } from "@revenuecat/purchases-capacitor";

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

  reconnect();

  return {
    disconnect() {
      active = false;
      if (listenerId) {
        void removeListener(listenerId).catch(onListenerError);
        listenerId = undefined;
      }
    },
    reconnect,
  };
}
