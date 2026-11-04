import { UpdateContext } from "./UpdateContext";
import {
  getNativeAppUpdateState,
  performNativeAppUpdate,
  resumeNativeAppUpdate,
} from "#src/lib/nativeAppUpdate.ts";
import { listenForAppState, type ListenForAppState } from "#src/lib/nativeAppLifecycle.ts";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

type SetUpdateAvailable = Dispatch<SetStateAction<boolean>>;

const nativeUpdates = { getNativeAppUpdateState, performNativeAppUpdate, resumeNativeAppUpdate };

async function checkForNativeUpdate(
  setIsUpdateAvailable: SetUpdateAvailable,
  updates: typeof nativeUpdates,
) {
  const result = await updates.getNativeAppUpdateState();
  setIsUpdateAvailable(result.isUpdateAvailable);
}

async function performNativeUpdateAndRefresh(
  setIsUpdateAvailable: SetUpdateAvailable,
  updates: typeof nativeUpdates,
) {
  const result = await updates.performNativeAppUpdate();
  await checkForNativeUpdate(setIsUpdateAvailable, updates);

  return result;
}

async function resumeNativeUpdateAndRefresh(
  setIsUpdateAvailable: SetUpdateAvailable,
  updates: typeof nativeUpdates,
) {
  const result = await updates.resumeNativeAppUpdate();

  if (result.status === "started") {
    await checkForNativeUpdate(setIsUpdateAvailable, updates);
  }
}

export function UpdateControllerNative({
  children,
  updates = nativeUpdates,
  subscribeToAppState = listenForAppState,
}: {
  children: React.ReactNode;
  updates?: typeof nativeUpdates;
  subscribeToAppState?: ListenForAppState;
}) {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  function update() {
    setIsUpdating(true);

    return performNativeUpdateAndRefresh(setIsUpdateAvailable, updates).finally(() => {
      setIsUpdating(false);
    });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- This is intentional
    void checkForNativeUpdate(setIsUpdateAvailable, updates);
  }, [updates]);

  // oxlint-disable-next-line react-doctor/effect-needs-cleanup -- Cleanup awaits and removes the promised Capacitor listener; follow-up: https://github.com/HorusGoul/trizum/issues/508
  useEffect(() => {
    void resumeNativeUpdateAndRefresh(setIsUpdateAvailable, updates);

    const listener = subscribeToAppState(({ isActive }) => {
      if (isActive) {
        void resumeNativeUpdateAndRefresh(setIsUpdateAvailable, updates);
      }
    });

    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [updates, subscribeToAppState]);

  return (
    <UpdateContext
      value={{
        isUpdateAvailable,
        isUpdating,
        update,
        checkForUpdate: () => void checkForNativeUpdate(setIsUpdateAvailable, updates),
      }}
    >
      {children}
    </UpdateContext>
  );
}
