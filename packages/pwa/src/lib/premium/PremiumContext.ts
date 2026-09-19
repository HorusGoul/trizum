import { createContext, useContext } from "react";

export type PremiumStatus = "error" | "free" | "loading" | "premium" | "unavailable";

export interface PremiumContextValue {
  hasActiveSubscription: boolean;
  isPremium: boolean;
  presentCustomerCenter: () => Promise<void>;
  presentPaywall: () => Promise<void>;
  status: PremiumStatus;
}

const PremiumContext = createContext<PremiumContextValue>({
  hasActiveSubscription: false,
  isPremium: false,
  presentCustomerCenter: async () => undefined,
  presentPaywall: async () => undefined,
  status: "unavailable",
});

export const PremiumContextProvider = PremiumContext.Provider;

export function usePremium() {
  return useContext(PremiumContext);
}
