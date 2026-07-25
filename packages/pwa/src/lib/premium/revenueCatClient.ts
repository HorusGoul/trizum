import type { CustomerInfo, PurchasesCallbackId } from "@revenuecat/purchases-capacitor";
import { getRevenueCatPlatform, getRevenueCatPublicApiKey } from "./revenueCatConfig.ts";
import { PREMIUM_ENTITLEMENT_IDENTIFIER } from "./premiumAccess.ts";

type CustomerInfoListener = (customerInfo: CustomerInfo) => void;

let configured = false;
let identifiedUserId: string | null = null;
let identityOperation = Promise.resolve<CustomerInfo | undefined>(undefined);

export class PremiumSignInRequiredError extends Error {
  constructor() {
    super("A signed-in trizum account is required to purchase Premium.");
    this.name = "PremiumSignInRequiredError";
  }
}

export async function synchronizeRevenueCatUser(userId: string) {
  identityOperation = identityOperation.catch(() => undefined).then(() => synchronizeUser(userId));
  return identityOperation;
}

export async function clearRevenueCatUser() {
  identityOperation = identityOperation.catch(() => undefined).then(logOutIdentifiedUser);
  return identityOperation;
}

export async function addRevenueCatCustomerInfoListener(listener: CustomerInfoListener) {
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  return Purchases.addCustomerInfoUpdateListener(listener);
}

export async function removeRevenueCatCustomerInfoListener(listenerId: PurchasesCallbackId) {
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  await Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: listenerId });
}

export async function presentRevenueCatPaywall(userId: string | null) {
  if (!userId) {
    throw new PremiumSignInRequiredError();
  }

  await synchronizeRevenueCatUser(userId);
  const { RevenueCatUI } = await import("@revenuecat/purchases-capacitor-ui");

  return RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: PREMIUM_ENTITLEMENT_IDENTIFIER,
    listener: {
      onPurchaseInitiated({ resumable }) {
        resumable.resume(identifiedUserId === userId);
      },
    },
  });
}

export async function presentRevenueCatCustomerCenter(userId: string | null) {
  if (!userId) {
    throw new PremiumSignInRequiredError();
  }

  await synchronizeRevenueCatUser(userId);
  const { RevenueCatUI } = await import("@revenuecat/purchases-capacitor-ui");
  await RevenueCatUI.presentCustomerCenter();
}

export async function refreshRevenueCatCustomerInfo() {
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  return Purchases.getCustomerInfo().then(({ customerInfo }) => customerInfo);
}

async function synchronizeUser(userId: string) {
  const platform = getRevenueCatPlatform();
  if (!platform) {
    return;
  }

  const { LOG_LEVEL, Purchases } = await import("@revenuecat/purchases-capacitor");

  if (!configured) {
    await Purchases.setLogLevel({
      level: import.meta.env.DEV ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN,
    });
    await Purchases.configure({
      apiKey: getRevenueCatPublicApiKey(platform),
      appUserID: userId,
      automaticDeviceIdentifierCollectionEnabled: false,
      diagnosticsEnabled: true,
    });
    configured = true;
    identifiedUserId = userId;

    return Purchases.getCustomerInfo().then(({ customerInfo }) => customerInfo);
  }

  if (identifiedUserId === userId) {
    return Purchases.getCustomerInfo().then(({ customerInfo }) => customerInfo);
  }

  const { customerInfo } = await Purchases.logIn({ appUserID: userId });
  identifiedUserId = userId;
  return customerInfo;
}

async function logOutIdentifiedUser() {
  if (!configured || !identifiedUserId) {
    return;
  }

  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  const { customerInfo } = await Purchases.logOut();
  identifiedUserId = null;
  return customerInfo;
}
