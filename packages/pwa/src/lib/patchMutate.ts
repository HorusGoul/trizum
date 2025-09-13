import { set, unset } from "@opentf/std";
import type { DiffResult } from "@opentf/obj-diff";

export function patchMutate<T>(obj: T, patches: DiffResult[]) {
  for (const p of patches) {
    if (p.t === 1 || p.t === 2) {
      set(obj, p.p, p.v);
    }

    if (p.t === 0) {
      unset(obj, p.p);
    }
  }
}
