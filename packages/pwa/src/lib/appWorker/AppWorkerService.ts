import type { Repo } from "@automerge/automerge-repo/slim";
import { recalculatePartyBalances } from "#src/lib/recalculatePartyBalances.ts";
import type { Party } from "#src/models/party.ts";
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

  async recalculateBalances(partyId: Party["id"]) {
    const repo = this.requireRepo();

    await repo.networkSubsystem.whenReady();

    return recalculatePartyBalances(repo, partyId);
  }

  private requireRepo() {
    if (!this.repo) {
      throw new Error("App worker has not been initialized");
    }

    return this.repo;
  }
}
