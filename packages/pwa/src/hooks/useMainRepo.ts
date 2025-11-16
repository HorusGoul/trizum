import { createContext, use } from "react";
import type { Repo } from "@automerge/automerge-repo/slim";

export const MainRepoContext = createContext<Repo | null>(null);

export function useMainRepo() {
  const repo = use(MainRepoContext);

  if (!repo) {
    throw new Error("Should be inside a MainRepoContext");
  }

  return repo;
}
