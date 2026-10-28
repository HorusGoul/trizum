import type { Repo } from "@automerge/automerge-repo/slim";
import { recalculateSynchronizedBalances, type RecalculateBalancesRequest } from "./balanceSync.ts";
import { createAppWorkerRepo } from "./createAppWorkerRepo.ts";
import type { AppWorkerApi, AppWorkerInitializeOptions } from "./proxy.ts";

export class AppWorkerService implements AppWorkerApi {
  private repo: Repo | null = null;

  async initialize(options: AppWorkerInitializeOptions) {
    if (this.repo) {
      return;
    }

    this.repo = createAppWorkerRepo(options);

    await this.repo.networkSubsystem.whenReady();
  }

  async recalculateBalances(request: RecalculateBalancesRequest) {
    const repo = this.requireRepo();

    await repo.networkSubsystem.whenReady();

    return recalculateSynchronizedBalances(repo, request);
  }

  private requireRepo() {
    if (!this.repo) {
      throw new Error("App worker has not been initialized");
    }

    return this.repo;
  }
}
