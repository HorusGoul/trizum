import type { Repo } from "@automerge/automerge-repo/slim";
import { recalculatePartyBalances } from "#src/lib/recalculatePartyBalances.ts";
import type { Party } from "#src/models/party.ts";
import { createAppWorkerRepo } from "./createAppWorkerRepo.ts";
import type { AppWorkerApi, AppWorkerInitializeOptions } from "./proxy.ts";
import {
  waitForBalanceCalculationDependencies,
  type BalanceCalculationDependency,
} from "./balanceCalculationSync.ts";

export class AppWorkerService implements AppWorkerApi {
  private repo: Repo | null = null;

  async initialize(options: AppWorkerInitializeOptions) {
    if (this.repo) {
      return;
    }

    this.repo = createAppWorkerRepo(options);

    await this.repo.networkSubsystem.whenReady();
  }

  async recalculateBalances(partyId: Party["id"], dependencies: BalanceCalculationDependency[]) {
    const repo = this.requireRepo();

    await repo.networkSubsystem.whenReady();

    // RPC and Automerge sync travel over separate channels. A ready document
    // can still predate the expense mutation that requested this calculation.
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error("Balance calculation sync timed out")),
      10_000,
    );
    try {
      await waitForBalanceCalculationDependencies(repo, dependencies, controller.signal);
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }

    return recalculatePartyBalances(repo, partyId);
  }

  private requireRepo() {
    if (!this.repo) {
      throw new Error("App worker has not been initialized");
    }

    return this.repo;
  }
}
