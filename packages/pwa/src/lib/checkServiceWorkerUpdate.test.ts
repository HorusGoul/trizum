import { expect, test, vi } from "vite-plus/test";
import { checkServiceWorkerUpdate } from "./checkServiceWorkerUpdate.ts";

test.each([
  new DOMException("Operation has been aborted", "AbortError"),
  new TypeError("An unknown error occurred when fetching the script"),
  new TypeError("Not found"),
])("handles an update check failure and permits a later retry: %s", async (error) => {
  const update = vi.fn<() => Promise<ServiceWorkerRegistration>>();
  const registration = { update };
  update.mockRejectedValueOnce(error);
  // SAFETY: The check ignores the resolved registration; only promise settlement is exercised.
  update.mockResolvedValueOnce({} as ServiceWorkerRegistration);

  await expect(checkServiceWorkerUpdate(registration)).resolves.toBeUndefined();
  await expect(checkServiceWorkerUpdate(registration)).resolves.toBeUndefined();
  expect(update).toHaveBeenCalledTimes(2);
});

test("accepts an unavailable registration", async () => {
  await expect(checkServiceWorkerUpdate(undefined)).resolves.toBeUndefined();
  await expect(checkServiceWorkerUpdate(null)).resolves.toBeUndefined();
});
