import { Capacitor } from "@capacitor/core";
import {
  AppUpdate,
  AppUpdateAvailability,
} from "@capawesome/capacitor-app-update";
import { UpdateContext } from "./UpdateContext";
import { useCallback, useEffect, useState } from "react";

export function UpdateControllerNative({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);

  const update = useCallback(() => {
    const platform = Capacitor.getPlatform();
    if (platform === "ios") {
      void AppUpdate.openAppStore({
        appId: "6755971747",
      });
    }

    if (platform === "android") {
      void AppUpdate.performImmediateUpdate();
    }
  }, []);

  const checkForUpdate = useCallback(async () => {
    const result = await AppUpdate.getAppUpdateInfo();

    if (result.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE) {
      setIsUpdateAvailable(true);
    } else {
      setIsUpdateAvailable(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- This is intentional
    void checkForUpdate();
  }, [checkForUpdate]);

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
