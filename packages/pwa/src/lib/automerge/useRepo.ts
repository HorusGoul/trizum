/**
 * @deprecated This file exists for backwards compatibility.
 * New code should use useTrizumClient from @trizum/sdk instead.
 */
import { useTrizumClient } from "@trizum/sdk";

/**
 * @deprecated Use useTrizumClient from @trizum/sdk instead.
 * This function provides access to the internal repo for backwards compatibility.
 */
export function useRepo() {
  const client = useTrizumClient();
  return client._internalRepo;
}
