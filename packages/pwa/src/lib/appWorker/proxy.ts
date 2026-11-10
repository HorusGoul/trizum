import "../../polyfills/promiseWithResolvers.ts";
import { defineProxy } from "comctx";
import type { DocumentHeads, RecalculateBalancesRequest } from "./balanceSync.ts";

export interface AppWorkerInitializeOptions {
  repoPort: MessagePort;
  wssUrl: string;
  isOfflineOnly: boolean;
}

export interface AppWorkerApi {
  initialize(options: AppWorkerInitializeOptions): Promise<void>;
  recalculateBalances(request: RecalculateBalancesRequest): Promise<DocumentHeads[]>;
}

const proxyOptions = {
  namespace: "__trizum_app_worker__",
  transfer: true,
  // Module/WASM startup and synchronous work can delay a healthy worker's heartbeat.
  heartbeatTimeout: 10_000,
};

// SAFETY: This factory is never provided on the client side; comctx injects the AppWorkerApi implemented by the matching worker provider.
export const [, injectAppWorker] = defineProxy(() => ({}) as AppWorkerApi, proxyOptions);

export function defineAppWorkerProvider(factory: () => AppWorkerApi) {
  const [provideAppWorker] = defineProxy(factory, proxyOptions);

  return provideAppWorker;
}
