import { useRegisterSW } from "virtual:pwa-register/react";
import { UpdateContext } from "./UpdateContext";
import { useRef } from "react";
import { toast } from "sonner";
import { t } from "@lingui/macro";

const UPDATE_TOAST_ID = "update-toast";

export function UpdateController({ children }: { children: React.ReactNode }) {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const didCheckForUpdateRef = useRef(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW: (_url, registration) => {
      registrationRef.current = registration ?? null;
      registration?.update();
    },
    onNeedRefresh() {
      if (!didCheckForUpdateRef.current) {
        return;
      }

      toast(t`Update available`, {
        action: {
          label: t`Reload`,
          onClick: () => update(),
        },
        id: UPDATE_TOAST_ID,
      });
    },
  });

  function update() {
    toast.loading(t`Updating trizum...`, {
      id: UPDATE_TOAST_ID,
    });
    updateServiceWorker(true);
  }

  return (
    <UpdateContext
      value={{
        isUpdateAvailable: needRefresh,
        update,
        checkForUpdate: () => {
          didCheckForUpdateRef.current = true;
          registrationRef.current?.update();
        },
      }}
    >
      {children}
    </UpdateContext>
  );
}
