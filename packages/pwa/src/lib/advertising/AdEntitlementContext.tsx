import { createContext, useContext } from "react";
import type { AdEntitlement } from "./AdvertisingCoordinator.ts";

export const AdEntitlementContext = createContext<AdEntitlement>("unknown");

export function useAdEntitlement() {
  return useContext(AdEntitlementContext);
}
