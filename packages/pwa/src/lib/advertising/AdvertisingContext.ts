import { createContext, useContext, useEffect } from "react";

interface AdvertisingContextValue {
  privacyOptionsRequired: boolean;
  presentInterstitialOpportunity: () => boolean;
  registerProtectedFlow: () => () => void;
  showPrivacyOptions: () => Promise<void>;
}

const AdvertisingContext = createContext<AdvertisingContextValue>({
  privacyOptionsRequired: false,
  presentInterstitialOpportunity: () => false,
  registerProtectedFlow: () => () => undefined,
  showPrivacyOptions: async () => undefined,
});

export const AdvertisingProvider = AdvertisingContext.Provider;

export function useAdvertising() {
  return useContext(AdvertisingContext);
}

export function useAdProtectedFlow(active: boolean) {
  const { registerProtectedFlow } = useAdvertising();

  useEffect(() => {
    if (!active) {
      return;
    }

    return registerProtectedFlow();
  }, [active, registerProtectedFlow]);
}
