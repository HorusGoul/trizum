import type { AnyDocumentId, Repo } from "@automerge/automerge-repo/slim";
import { clearAppData, getAppData } from "../data/client.ts";

/** Source-side compatibility for existing integration fixtures. Values live in Fate. */
export const documentCache = {
  readAsync: (repo: Repo, id: AnyDocumentId) => getAppData(repo).read(String(id)),
  getValueIfCached: (repo: Repo, id: AnyDocumentId) => getAppData(repo).peek(String(id)),
  getStatus: (repo: Repo, id: AnyDocumentId) => getAppData(repo).status(String(id)),
  subscribe: (listener: () => void, repo: Repo, id: AnyDocumentId) =>
    getAppData(repo).subscribe(String(id), listener),
  prefetch: (repo: Repo, id: AnyDocumentId) => {
    void getAppData(repo).read(String(id));
  },
  evictAll: clearAppData,
};
