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
};

export const [, injectAppWorker] = defineProxy(() => ({}) as AppWorkerApi, proxyOptions);

export function defineAppWorkerProvider(factory: () => AppWorkerApi) {
  const [provideAppWorker] = defineProxy(factory, proxyOptions);

  return provideAppWorker;
}
