import { Repo } from "@automerge/automerge-repo/slim";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";

const repoCache = new Map<string, Repo>();

export function findOrCreateRepoById(id: string): Repo {
  let repo = repoCache.get(id);

  if (!repo) {
    repo = new Repo({
      storage: new IndexedDBStorageAdapter(`trizum-${id}`),
      network: [],
    });

    repoCache.set(id, repo);
  }

  return repo;
}

export function closeRepoById(id: string) {
  const repo = repoCache.get(id);

  if (!repo) {
    return;
  }

  void repo.shutdown();
  repoCache.delete(id);
}
