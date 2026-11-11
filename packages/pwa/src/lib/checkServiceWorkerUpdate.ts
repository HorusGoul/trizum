import { getLogger } from "./log.ts";

const logger = getLogger("lib", "serviceWorkerUpdate");

export async function checkServiceWorkerUpdate(
  registration: Pick<ServiceWorkerRegistration, "update"> | null | undefined,
): Promise<void> {
  try {
    await registration?.update();
  } catch (error) {
    // A failed check leaves the active worker usable. A later check can retry.
    logger.warning("Service worker update check failed", { error });
  }
}
