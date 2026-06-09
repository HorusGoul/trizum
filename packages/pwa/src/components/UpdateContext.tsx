import { createContext } from "react";

export type UpdateResult = {
  status: "canceled" | "failed" | "not-allowed" | "started" | "unavailable";
};

interface UpdateContextType {
  isUpdateAvailable: boolean;
  update: () => Promise<UpdateResult>;
  checkForUpdate: () => void;
}

export const UpdateContext = createContext<UpdateContextType>({
  isUpdateAvailable: false,
  update: () => Promise.resolve({ status: "unavailable" }),
  checkForUpdate: () => {},
});
