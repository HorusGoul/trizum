import { createContext, useContext } from "react";
import type { AdEntitlement } from "./AdvertisingCoordinator.ts";

export const AdEntitlementContext = createContext<AdEntitlement>("adSupported");

export function useAdEntitlement() {
  return useContext(AdEntitlementContext);
}
