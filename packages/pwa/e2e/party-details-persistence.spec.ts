import { createPartyFixture, defaultParticipants } from "./harness/scenarios";
import { expect, test } from "./harness/trizum.fixture";

test("a confirmed details save survives an immediate document reload", async ({
  harness,
  page,
}) => {
  const fixture = createPartyFixture();
  fixture.party.name = "Before save";
  const { partyId } = await harness.seedJoinedParty({
    fixture,
    memberParticipantId: defaultParticipants.blair.id,
  });
  await harness.goto(`/party/${partyId}/settings`);
  await page.locator(`a[href="/party/${partyId}/settings/details"]`).click();
  await page.getByLabel("Name", { exact: true }).fill("After save");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/party/${partyId}/settings(?:[?].*)?$`));
  await expect(page.getByRole("link", { name: /After save/ })).toBeVisible();
  await harness.goto(`/party/${partyId}/settings/details`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("After save");
  await expect(page.getByRole("button", { name: "Symbol", exact: true })).toHaveText("🏕️");
});

test("a failed details save keeps the draft available for retry", async ({ harness, page }) => {
  const { partyId } = await harness.seedJoinedParty({
    fixture: createPartyFixture(),
    memberParticipantId: defaultParticipants.blair.id,
  });
  const details = `/party/${partyId}/settings/details`;
  await harness.goto(`/party/${partyId}/settings`);
  await page.locator(`a[href="${details}"]`).click();
  await page.getByLabel("Name", { exact: true }).fill("Retry this save");
  await page.evaluate(() => {
    const original = Reflect.get(
      IDBDatabase.prototype,
      "transaction",
    ) as IDBDatabase["transaction"];
    const testWindow = window as Window & { restorePersistenceTest?: () => void };
    testWindow.restorePersistenceTest = () => {
      IDBDatabase.prototype.transaction = original;
      delete testWindow.restorePersistenceTest;
    };
    IDBDatabase.prototype.transaction = function (...args) {
      if (this.name === "trizum" && args[1] === "readwrite") {
        throw new DOMException("Synthetic storage failure", "QuotaExceededError");
      }
      return original.apply(this, args);
    };
  });
  try {
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByText("Could not save party details. Please try again.", { exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${details}(?:[?].*)?$`));
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Retry this save");
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
    await expect(page.getByText("Party details saved!", { exact: true })).toBeHidden();
  } finally {
    await page.evaluate(() => {
      (window as Window & { restorePersistenceTest?: () => void }).restorePersistenceTest?.();
    });
  }
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/party/${partyId}/settings(?:[?].*)?$`));
  await expect(page.getByRole("link", { name: /Retry this save/ })).toBeVisible();
  await harness.goto(details);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Retry this save");
});
