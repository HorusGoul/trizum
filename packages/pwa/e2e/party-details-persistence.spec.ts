import type { Page } from "@playwright/test";
import { createPartyFixture, defaultParticipants } from "./harness/scenarios";
import { expect, test } from "./harness/trizum.fixture";

async function holdNextSaveAcknowledgment(page: Page) {
  await page.evaluate(() => {
    const original = Reflect.get(
      IDBDatabase.prototype,
      "transaction",
    ) as IDBDatabase["transaction"];
    const testWindow = window as Window & {
      releasePersistenceTest?: () => void;
      restorePersistenceTest?: () => void;
    };
    let holdNextWrite = true;
    testWindow.restorePersistenceTest = () => {
      IDBDatabase.prototype.transaction = original;
      testWindow.releasePersistenceTest?.();
      delete testWindow.restorePersistenceTest;
    };
    IDBDatabase.prototype.transaction = function (...args) {
      const transaction = original.apply(this, args);
      if (this.name === "trizum" && args[1] === "readwrite" && holdNextWrite) {
        holdNextWrite = false;
        // The adapter's oncomplete is installed after this listener. Hold only
        // its acknowledgment, while allowing the real IndexedDB write to commit.
        transaction.addEventListener("complete", (event) => {
          event.stopImmediatePropagation();
          testWindow.releasePersistenceTest = () => {
            transaction.oncomplete?.call(transaction, event);
            delete testWindow.releasePersistenceTest;
          };
        });
      }
      return transaction;
    };
  });
}

async function releaseSaveAcknowledgment(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          (window as Window & { releasePersistenceTest?: () => void }).releasePersistenceTest,
        ),
      ),
    )
    .toBe(true);
  await page.evaluate(async () => {
    (window as Window & { releasePersistenceTest?: () => void }).releasePersistenceTest?.();
    // Complete the submit microtasks and a render/history cycle before asserting
    // that a departed form cannot move the user's current history entry.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

async function restoreSaveAcknowledgment(page: Page) {
  await page.evaluate(() => {
    (window as Window & { restorePersistenceTest?: () => void }).restorePersistenceTest?.();
  });
}

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

test("a failed details save keeps the draft available for retry", async ({
  harness,
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
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
    await expect
      .poll(async () => {
        const bounds = await page
          .getByText("Could not save party details. Please try again.", { exact: true })
          .boundingBox();
        return Boolean(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 812);
      })
      .toBe(true);
    await page.screenshot({ path: testInfo.outputPath("save-error-retains-draft.png") });
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

test("details cannot change while their save acknowledgment is pending", async ({
  harness,
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const { partyId } = await harness.seedJoinedParty({
    fixture: createPartyFixture(),
    memberParticipantId: defaultParticipants.blair.id,
  });
  await harness.goto(`/party/${partyId}/settings`);
  await page.locator(`a[href="/party/${partyId}/settings/details"]`).click();
  await page.getByLabel("Name", { exact: true }).fill("Pending save");
  await holdNextSaveAcknowledgment(page);
  try {
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Submitting...", exact: true })).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toBeDisabled();
    await expect(page.getByLabel("Description", { exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Symbol", exact: true })).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath("save-pending-protected-fields.png") });
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean(
            (window as Window & { releasePersistenceTest?: () => void }).releasePersistenceTest,
          ),
        ),
      )
      .toBe(true);
    await page.evaluate(() => {
      (window as Window & { releasePersistenceTest?: () => void }).releasePersistenceTest?.();
    });
    await expect(page).toHaveURL(new RegExp(`/party/${partyId}/settings(?:[?].*)?$`));
  } finally {
    await page.evaluate(() => {
      (window as Window & { restorePersistenceTest?: () => void }).restorePersistenceTest?.();
    });
  }
  await harness.goto(`/party/${partyId}/settings/details`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Pending save");
});

for (const back of ["header", "browser", "native-style"] as const) {
  test(`a pending save respects ${back} Back departure`, async ({ harness, page }) => {
    const { partyId } = await harness.seedJoinedParty({
      fixture: createPartyFixture(),
      memberParticipantId: defaultParticipants.blair.id,
    });
    const settings = `/party/${partyId}/settings`;
    const details = `${settings}/details`;
    await harness.goto(settings);
    await page.locator(`a[href="${details}"]`).click();
    await page.getByLabel("Name", { exact: true }).fill("Saved after leaving");
    await holdNextSaveAcknowledgment(page);
    try {
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByRole("button", { name: "Submitting...", exact: true })).toBeVisible();
      if (back === "header") {
        await page.getByRole("button", { name: "Go Back", exact: true }).click();
      } else if (back === "browser") {
        await page.goBack();
      } else {
        await page.evaluate(() => window.history.go(-1));
      }
      await expect(page).toHaveURL(new RegExp(`${settings}(?:[?].*)?$`));
      await expect(
        page.getByRole("heading", { name: "Party Settings", exact: true }),
      ).toBeVisible();
      const departedEntry = await page.evaluate(() => window.history.state.__TSR_key);
      await releaseSaveAcknowledgment(page);
      await expect(page).toHaveURL(new RegExp(`${settings}(?:[?].*)?$`));
      await expect(
        page.getByRole("heading", { name: "Party Settings", exact: true }),
      ).toBeVisible();
      expect(await page.evaluate(() => window.history.state.__TSR_key)).toBe(departedEntry);
    } finally {
      await restoreSaveAcknowledgment(page);
    }
    await harness.goto(details);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Saved after leaving");
  });
}
