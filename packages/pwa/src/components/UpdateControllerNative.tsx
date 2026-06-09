import { UpdateContext } from "./UpdateContext";
import {
  getNativeAppUpdateState,
  performNativeAppUpdate,
  resumeNativeAppUpdate,
} from "#src/lib/nativeAppUpdate.ts";
import { App } from "@capacitor/app";
import { useCallback, useEffect, useState } from "react";

export function UpdateControllerNative({ children }: { children: React.ReactNode }) {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);

  const checkForUpdate = useCallback(async () => {
    const result = await getNativeAppUpdateState();
    setIsUpdateAvailable(result.isUpdateAvailable);
  }, []);

  const update = useCallback(async () => {
    const result = await performNativeAppUpdate();
    await checkForUpdate();
    return result;
  }, [checkForUpdate]);

  const resumeUpdate = useCallback(async () => {
    const result = await resumeNativeAppUpdate();
    if (result.status === "started") {
      await checkForUpdate();
    }
  }, [checkForUpdate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- This is intentional
    void checkForUpdate();
  }, [checkForUpdate]);

  useEffect(() => {
    void resumeUpdate();
    const listener = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        void resumeUpdate();
      }
    });

    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [resumeUpdate]);

  return (
    <UpdateContext
      value={{
        isUpdateAvailable,
        update,
        checkForUpdate: () => void checkForUpdate(),
      }}
    >
      {children}
    </UpdateContext>
  );
}
