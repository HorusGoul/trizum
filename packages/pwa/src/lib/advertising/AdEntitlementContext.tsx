import { createContext, useContext } from "react";
import type { AdEntitlement } from "./AdvertisingCoordinator.ts";

const defaultEntitlement: AdEntitlement =
  import.meta.env.VITE_APP_AD_TEST_MODE === "true" ? "adSupported" : "unknown";

export const AdEntitlementContext = createContext<AdEntitlement>(defaultEntitlement);

export function useAdEntitlement() {
  return useContext(AdEntitlementContext);
}
