import { defineProxy } from "comctx";
import type { PartyBalanceHeadsResult } from "#src/lib/partyBalanceHeads.ts";
import type { Party } from "#src/models/party.ts";

export interface AppWorkerInitializeOptions {
  repoPort: MessagePort;
  wssUrl: string;
  isOfflineOnly: boolean;
}

export interface AppWorkerApi {
  initialize(options: AppWorkerInitializeOptions): Promise<void>;
  recalculateBalances(partyId: Party["id"]): Promise<PartyBalanceHeadsResult>;
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
