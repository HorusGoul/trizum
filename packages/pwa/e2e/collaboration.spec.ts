import { ExpenseEditorPage } from "./pages/expense-editor.page";
import { JoinTrizumPage } from "./pages/join-trizum.page";
import { NewTrizumPage } from "./pages/new-trizum.page";
import { PartyPage } from "./pages/party.page";
import { WhoAreYouPage } from "./pages/who-are-you.page";
import { expect, test } from "./harness/trizum.fixture";
import type { Browser, BrowserContext, Page, TestInfo } from "@playwright/test";

test.describe("Jazz collaboration", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Jazz Cloud collaboration runs once.");

  test("syncs a joined party, expenses, and realtime editor drafts", async ({
    baseURL,
    browser,
  }, testInfo) => {
    const aliceSession = await createCollaborationSession(browser, "alice", testInfo, baseURL);
    const bobSession = await createCollaborationSession(browser, "bob", testInfo, baseURL);

    try {
      const partyName = `Jazz collaboration ${Date.now()}`;
      const initialExpenseTitle = `Shared lunch ${Date.now()}`;
      const updatedExpenseTitle = `${initialExpenseTitle} updated`;
      const amount = 42.5;
      const amountText = formatAmountText(amount);

      await test.step("Alice creates the party and selects her identity", async () => {
        const newTrizumPage = new NewTrizumPage(aliceSession.page);
        const whoAreYouPage = new WhoAreYouPage(aliceSession.page);

        await aliceSession.goto("/new");
        await newTrizumPage.expectLoaded();
        await newTrizumPage.createParty({
          name: partyName,
          participants: ["Alice", "Bob"],
        });
        await whoAreYouPage.expectLoaded();
        await whoAreYouPage.selectParticipant("Alice");
        await expect(aliceSession.page.getByRole("heading", { name: partyName })).toBeVisible();
      });

      const partyId = getPartyIdFromUrl(aliceSession.page);

      await test.step("Bob joins the same party and selects his identity", async () => {
        const joinTrizumPage = new JoinTrizumPage(bobSession.page);
        const whoAreYouPage = new WhoAreYouPage(bobSession.page);
        const bobPartyPage = new PartyPage(bobSession.page);

        await bobSession.goto("/join");
        await joinTrizumPage.expectLoaded();
        await joinTrizumPage.joinWithCode(partyId);
        await whoAreYouPage.expectLoaded();
        await whoAreYouPage.selectParticipant("Bob");
        await bobPartyPage.expectLoaded(partyId, partyName);
      });

      let expenseId = "";

      await test.step("Alice adds an expense and Bob sees it live", async () => {
        const alicePartyPage = new PartyPage(aliceSession.page);
        const aliceExpenseEditorPage = new ExpenseEditorPage(aliceSession.page);
        const bobPartyPage = new PartyPage(bobSession.page);

        await alicePartyPage.openAddExpense();
        await aliceExpenseEditorPage.expectLoaded();
        await aliceExpenseEditorPage.fillTitle(initialExpenseTitle);
        await aliceExpenseEditorPage.fillAmount(amount);
        await aliceExpenseEditorPage.setParticipantIncluded("Alice", true);
        await aliceExpenseEditorPage.setParticipantIncluded("Bob", true);
        await aliceExpenseEditorPage.save();

        expenseId = getExpenseIdFromUrl(aliceSession.page);

        await bobPartyPage.expectExpenseInLog(initialExpenseTitle, amountText);
      });

      await test.step("Alice's edit draft updates Bob's editor in realtime", async () => {
        await aliceSession.goto(`/party/${partyId}/expense/${expenseId}/edit`);
        await bobSession.goto(`/party/${partyId}/expense/${expenseId}/edit`);

        await expect(aliceSession.page.getByRole("heading", { name: /Editing/ })).toBeVisible();
        await expect(bobSession.page.getByRole("heading", { name: /Editing/ })).toBeVisible();

        await aliceSession.page.getByLabel("Title").fill(updatedExpenseTitle);

        await expect(bobSession.page.getByLabel("Title")).toHaveValue(updatedExpenseTitle, {
          timeout: 30_000,
        });
      });

      await test.step("Alice saves the edit and Bob sees the committed expense", async () => {
        const bobPartyPage = new PartyPage(bobSession.page);

        await aliceSession.page.getByRole("button", { name: "Save" }).click();
        await expect(
          aliceSession.page.getByRole("heading", { name: updatedExpenseTitle }),
        ).toBeVisible();

        await bobSession.goto(`/party/${partyId}?tab=expenses`);
        await bobPartyPage.expectExpenseInLog(updatedExpenseTitle, amountText);
      });
    } finally {
      await Promise.all([aliceSession.context.close(), bobSession.context.close()]);
    }
  });
});

type CollaborationSession = {
  context: BrowserContext;
  dbName: string;
  goto: (path: string) => Promise<void>;
  page: Page;
};

async function createCollaborationSession(
  browser: Browser,
  label: string,
  testInfo: TestInfo,
  baseURL: string | undefined,
): Promise<CollaborationSession> {
  const dbName = createCollaborationDbName(testInfo, label);
  const context = await browser.newContext({
    baseURL,
    serviceWorkers: "block",
  });
  const page = await context.newPage();

  await context.route(isSentryUrl, async (route) => {
    await route.abort();
  });

  return {
    context,
    dbName,
    goto: (path) => page.goto(createOnlinePath(path, dbName)).then(() => undefined),
    page,
  };
}

function createOnlinePath(pathname: string, dbName: string) {
  const url = new URL(pathname, "http://trizum.local");
  url.searchParams.set("__internal_db_name", dbName);

  return `${url.pathname}${url.search}${url.hash}`;
}

function createCollaborationDbName(testInfo: TestInfo, label: string) {
  const testSlug = testInfo.testId.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 100);

  return `trizum-e2e-collab-${testInfo.project.name}-${testInfo.workerIndex}-${testInfo.retry}-${testSlug}-${label}`;
}

function formatAmountText(amount: number) {
  return amount.toFixed(2).replace(".", ",");
}

function getPartyIdFromUrl(page: Page) {
  const match = new URL(page.url()).pathname.match(/^\/party\/([^/]+)/);

  if (!match?.[1]) {
    throw new Error(`Expected party route, got ${page.url()}`);
  }

  return match[1];
}

function getExpenseIdFromUrl(page: Page) {
  const match = new URL(page.url()).pathname.match(/^\/party\/[^/]+\/expense\/([^/]+)/);

  if (!match?.[1]) {
    throw new Error(`Expected expense route, got ${page.url()}`);
  }

  return match[1];
}

function isSentryUrl(url: URL) {
  return url.hostname === "sentry.io" || url.hostname.endsWith(".sentry.io");
}
