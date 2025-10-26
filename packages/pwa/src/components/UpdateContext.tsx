import { createContext } from "react";

interface UpdateContextType {
  isUpdateAvailable: boolean;
  update: () => void;
  checkForUpdate: () => void;
}

export const UpdateContext = createContext<UpdateContextType>({
  isUpdateAvailable: false,
  update: () => {},
  checkForUpdate: () => {},
});
