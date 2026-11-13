import { createContext } from "react";

export interface ModalSheetNavigation {
  /** Register an open sheet. Return true from dismiss when it accepts closing. */
  register: (dismiss: () => boolean) => () => void;
}

export const ModalSheetNavigationContext = createContext<ModalSheetNavigation | undefined>(
  undefined,
);
