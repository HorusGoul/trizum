import type { Page } from "playwright";
import { getMigrationData } from "./data/migration-data.ts";
import type { StoreLocale } from "./store-design.ts";

export async function seedScreenshotParty(page: Page, locale: StoreLocale): Promise<string> {
  await page.waitForFunction(
    () =>
      "__internal_createPartyFromMigrationData" in window &&
      "__internal_recalculatePartyBalances" in window,
  );

  return page.evaluate(async (data) => {
    // SAFETY: The PWA exposes these internal hooks for browser automation.
    const harness = window as typeof window & {
      __internal_createPartyFromMigrationData(migrationData: typeof data): Promise<string>;
      __internal_recalculatePartyBalances(partyId: string): Promise<boolean>;
    };

    const partyId = await harness.__internal_createPartyFromMigrationData(data);

    // Expense imports schedule balance calculation in the worker. Finish it before
    // navigation can terminate the worker and leave persisted balances empty.
    if (!(await harness.__internal_recalculatePartyBalances(partyId))) {
      throw new Error("Failed to calculate screenshot party balances");
    }

    return partyId;
  }, getMigrationData(locale));
}
