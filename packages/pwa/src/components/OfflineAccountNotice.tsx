import { Trans } from "@lingui/react/macro";
import { useAppSession } from "#src/lib/auth-client.ts";

export function OfflineAccountNotice() {
  const session = useAppSession();

  if (!session.isOffline) {
    return null;
  }

  return (
    <output className="block rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
      <Trans>Working offline. Your account will refresh when you reconnect.</Trans>
    </output>
  );
}
