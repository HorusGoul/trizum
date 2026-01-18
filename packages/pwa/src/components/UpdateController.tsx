import { t } from "@lingui/core/macro";
import { useRegisterSW } from "virtual:pwa-register/react";
import { UpdateContext } from "./UpdateContext";
import { useRef } from "react";
import { toast } from "sonner";

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
      void registration?.update();
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
    void updateServiceWorker(true);
  }

  return (
    <UpdateContext
      value={{
        isUpdateAvailable: needRefresh,
        update,
        checkForUpdate: () => {
          didCheckForUpdateRef.current = true;
          void registrationRef.current?.update();
        },
      }}
    >
      {children}
    </UpdateContext>
  );
}
