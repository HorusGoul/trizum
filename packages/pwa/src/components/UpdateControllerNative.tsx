import { UpdateContext } from "./UpdateContext";
import {
  getNativeAppUpdateState,
  performNativeAppUpdate,
  resumeNativeAppUpdate,
} from "#src/lib/nativeAppUpdate.ts";
import { App } from "@capacitor/app";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

type SetUpdateAvailable = Dispatch<SetStateAction<boolean>>;

async function checkForNativeUpdate(setIsUpdateAvailable: SetUpdateAvailable) {
  const result = await getNativeAppUpdateState();
  setIsUpdateAvailable(result.isUpdateAvailable);
}

async function performNativeUpdateAndRefresh(setIsUpdateAvailable: SetUpdateAvailable) {
  const result = await performNativeAppUpdate();
  await checkForNativeUpdate(setIsUpdateAvailable);
  return result;
}

async function resumeNativeUpdateAndRefresh(setIsUpdateAvailable: SetUpdateAvailable) {
  const result = await resumeNativeAppUpdate();
  if (result.status === "started") {
    await checkForNativeUpdate(setIsUpdateAvailable);
  }
}

export function UpdateControllerNative({ children }: { children: React.ReactNode }) {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  function update() {
    setIsUpdating(true);
    return performNativeUpdateAndRefresh(setIsUpdateAvailable).finally(() => {
      setIsUpdating(false);
    });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- This is intentional
    void checkForNativeUpdate(setIsUpdateAvailable);
  }, []);

  useEffect(() => {
    void resumeNativeUpdateAndRefresh(setIsUpdateAvailable);
    const listener = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        void resumeNativeUpdateAndRefresh(setIsUpdateAvailable);
      }
    });

    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, []);

  return (
    <UpdateContext
      value={{
        isUpdateAvailable,
        isUpdating,
        update,
        checkForUpdate: () => void checkForNativeUpdate(setIsUpdateAvailable),
      }}
    >
      {children}
    </UpdateContext>
  );
}
