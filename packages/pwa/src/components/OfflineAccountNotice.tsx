import { Trans } from "@lingui/react/macro";
import { useAppSession } from "#src/lib/auth-client.ts";

export function OfflineAccountNotice() {
  const session = useAppSession();

  if (!session.isOffline) {
    return null;
  }

  return (
    <output className="bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-200 block rounded-lg px-4 py-3 text-sm">
      <Trans>Working offline. Your account will refresh when you reconnect.</Trans>
    </output>
  );
}
