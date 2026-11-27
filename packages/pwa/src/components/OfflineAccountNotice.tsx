import { Trans } from "@lingui/react/macro";
import { useAppSession } from "#src/lib/auth-client.ts";

export function OfflineAccountNotice() {
  const session = useAppSession();

  if (!session.isOffline) {
    return null;
  }

  return (
    <output className="shadow-surface block rounded-2xl bg-white px-4 py-3 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
      <Trans>Working offline. Your account will refresh when you reconnect.</Trans>
    </output>
  );
}
