import type {
  CustomerInfo,
  PurchasesCallbackId,
  PurchasesPlugin,
} from "@revenuecat/purchases-capacitor";
import { getRevenueCatPlatform, getRevenueCatPublicApiKey } from "./revenueCatConfig.ts";

import { getLogger } from "../log.ts";
import { getPremiumAccess } from "./premiumAccess.ts";
import {
  finishPremiumRedemption,
  getStoreRedemptionUrl,
  hasPendingPremiumRedemption,
  rememberPremiumRedemption,
} from "./premiumRedemption.ts";

const logger = getLogger("lib", "revenueCatClient");

type CustomerInfoListener = (customerInfo: CustomerInfo) => void;

export class PremiumSignInRequiredError extends Error {
  constructor() {
    super("A signed-in trizum account is required to purchase Premium.");
    this.name = "PremiumSignInRequiredError";
  }
}

export type RevenueCatStore = Pick<
  PurchasesPlugin,
  | "configure"
  | "setLogLevel"
  | "getCustomerInfo"
  | "logIn"
  | "logOut"
  | "syncPurchases"
  | "invalidateCustomerInfoCache"
  | "presentCodeRedemptionSheet"
  | "addCustomerInfoUpdateListener"
  | "removeCustomerInfoUpdateListener"
>;

export function createRevenueCatClient({
  // Keep the plugin inside its module: resolving a Promise with the proxy calls Purchases.then().
  getStore = () => import("@revenuecat/purchases-capacitor"),
  getPlatform = getRevenueCatPlatform,
  getPublicApiKey = getRevenueCatPublicApiKey,
}: {
  getStore?: () => Promise<{ Purchases: RevenueCatStore }>;
  getPlatform?: typeof getRevenueCatPlatform;
  getPublicApiKey?: (platform: NonNullable<ReturnType<typeof getRevenueCatPlatform>>) => string;
} = {}) {
  let configured = false;
  let identifiedUserId: string | null = null;
  let identityOperation = Promise.resolve<CustomerInfo | undefined>(undefined);

  async function synchronizeRevenueCatUser(userId: string) {
    const customerInfo = await prepareRevenueCatUser(userId);

    return customerInfo ?? refreshRevenueCatCustomerInfo();
  }

  async function prepareRevenueCatUser(userId: string) {
    identityOperation = identityOperation.catch(() => undefined).then(() => identifyUser(userId));

    return identityOperation;
  }

  async function clearRevenueCatUser() {
    identityOperation = identityOperation.catch(() => undefined).then(logOutIdentifiedUser);

    return identityOperation;
  }

  async function addRevenueCatCustomerInfoListener(listener: CustomerInfoListener) {
    const { Purchases } = await getStore();

    return Purchases.addCustomerInfoUpdateListener(listener);
  }

  async function removeRevenueCatCustomerInfoListener(listenerId: PurchasesCallbackId) {
    const { Purchases } = await getStore();
    await Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: listenerId });
  }

  async function presentRevenueCatCustomerCenter(userId: string | null) {
    if (!userId) {
      throw new PremiumSignInRequiredError();
    }

    await synchronizeRevenueCatUser(userId);
    const { RevenueCatUI } = await import("@revenuecat/purchases-capacitor-ui");
    await RevenueCatUI.presentCustomerCenter();
  }

  async function refreshRevenueCatCustomerInfo() {
    const { Purchases } = await getStore();
    const userId = identifiedUserId;
    const pendingRedemption = userId && hasPendingPremiumRedemption(userId);
    let redemptionSynced = false;

    if (pendingRedemption) {
      try {
        await Purchases.syncPurchases();
        await Purchases.invalidateCustomerInfoCache();
        redemptionSynced = true;
      } catch {
        // Preserve cached/offline access, and retry pending redemption on the next refresh.
        logger.warning("Could not sync pending code redemption");
      }
    }

    const { customerInfo } = await Purchases.getCustomerInfo();

    if (userId && redemptionSynced && getPremiumAccess(customerInfo).isPremium) {
      finishPremiumRedemption(userId);
    }

    return customerInfo;
  }

  async function identifyUser(userId: string) {
    const platform = getPlatform();

    if (!platform) {
      return;
    }

    const { LOG_LEVEL } = await import("@revenuecat/purchases-capacitor");
    const { Purchases } = await getStore();

    if (!configured) {
      await Purchases.setLogLevel({
        level: import.meta.env.DEV ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN,
      });
      await Purchases.configure({
        apiKey: getPublicApiKey(platform),
        appUserID: userId,
        automaticDeviceIdentifierCollectionEnabled: false,
        diagnosticsEnabled: true,
      });
      configured = true;
      identifiedUserId = userId;

      return;
    }

    if (identifiedUserId === userId) {
      return;
    }

    const { customerInfo } = await Purchases.logIn({ appUserID: userId });
    identifiedUserId = userId;

    return customerInfo;
  }

  async function logOutIdentifiedUser() {
    if (!configured || !identifiedUserId) {
      return;
    }

    const { Purchases } = await getStore();
    const { customerInfo } = await Purchases.logOut();
    identifiedUserId = null;

    return customerInfo;
  }

  async function openPremiumCodeRedemption(userId: string | null, code: string) {
    if (!userId) {
      throw new PremiumSignInRequiredError();
    }

    const platform = getPlatform();

    if (!platform) {
      throw new Error("Code redemption requires a native store.");
    }

    await prepareRevenueCatUser(userId);
    rememberPremiumRedemption(userId);

    if (platform === "ios" && !code.trim()) {
      const { Purchases } = await getStore();
      await Purchases.presentCodeRedemptionSheet();
    } else {
      // Capacitor opens external origins in the system browser/store, outside the app webview.
      window.location.assign(getStoreRedemptionUrl(platform, code));
    }
  }

  return {
    synchronizeRevenueCatUser,
    prepareRevenueCatUser,
    clearRevenueCatUser,
    addRevenueCatCustomerInfoListener,
    removeRevenueCatCustomerInfoListener,
    presentRevenueCatCustomerCenter,
    refreshRevenueCatCustomerInfo,
    openPremiumCodeRedemption,
  };
}

export const {
  synchronizeRevenueCatUser,
  prepareRevenueCatUser,
  clearRevenueCatUser,
  addRevenueCatCustomerInfoListener,
  removeRevenueCatCustomerInfoListener,
  presentRevenueCatCustomerCenter,
  refreshRevenueCatCustomerInfo,
  openPremiumCodeRedemption,
} = createRevenueCatClient();
