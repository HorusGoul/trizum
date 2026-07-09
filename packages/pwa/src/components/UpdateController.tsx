import { t } from "@lingui/core/macro";
import { useRegisterSW } from "virtual:pwa-register/react";
import { showUpdateResultFeedback } from "#src/lib/updateResultFeedback.ts";
import { type UpdateResult, UpdateContext } from "./UpdateContext";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { showUpdatingToast, UPDATE_TOAST_ID } from "#src/lib/updateToastPreview.ts";

export function UpdateController({ children }: { children: React.ReactNode }) {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const didCheckForUpdateRef = useRef(false);
  const [isUpdating, setIsUpdating] = useState(false);
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
          onClick: () => void update().then(showUpdateResultFeedback),
        },
        id: UPDATE_TOAST_ID,
      });
    },
  });

  async function update(): Promise<UpdateResult> {
    setIsUpdating(true);
    showUpdatingToast();
    try {
      await updateServiceWorker(true);
      return { status: "started" };
    } catch {
      toast.dismiss(UPDATE_TOAST_ID);
      setIsUpdating(false);
      return { status: "failed" };
    }
  }

  return (
    <UpdateContext
      value={{
        isUpdateAvailable: needRefresh,
        isUpdating,
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
