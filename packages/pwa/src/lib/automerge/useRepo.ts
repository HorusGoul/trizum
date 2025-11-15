import { use } from "react";
import { RepoContext } from "./RepoContext";

export function useRepo() {
  const repo = use(RepoContext);

  if (!repo) {
    throw new Error("Should be inside a RepoContext");
  }

  return repo;
}
