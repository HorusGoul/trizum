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
    test.setTimeout(240_000);

    const aliceSession = await createCollaborationSession(browser, "alice", testInfo, baseURL);
    const bobSession = await createCollaborationSession(browser, "bob", testInfo, baseURL);

    try {
      const partyName = `Jazz collaboration ${Date.now()}`;
      const initialExpenseTitle = `Shared lunch ${Date.now()}`;
      const aliceDraftExpenseTitle = `${initialExpenseTitle} alice draft`;
      const bobDraftExpenseTitle = `${initialExpenseTitle} bob draft`;
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
        await selectParticipantIdentity(aliceSession.page, "Alice");
        await expect(aliceSession.page.getByRole("heading", { name: partyName })).toBeVisible();
      });

      const partyId = getPartyIdFromUrl(aliceSession.page);

      await waitForDataSync(aliceSession.page);
      await bobSession.goto("/");
      await expect
        .poll(() => readPartySnapshot(bobSession.page, partyId, "settled"), {
          timeout: 60_000,
        })
        .toMatchObject({
          name: partyName,
        });
      await expect
        .poll(() => readPartyParticipantNames(bobSession.page, partyId, "settled"), {
          timeout: 90_000,
        })
        .toEqual(["Alice", "Bob"]);

      await test.step("Bob joins the same party and selects his identity", async () => {
        const joinTrizumPage = new JoinTrizumPage(bobSession.page);
        const whoAreYouPage = new WhoAreYouPage(bobSession.page);
        const bobPartyPage = new PartyPage(bobSession.page);

        await bobSession.goto("/join");
        await joinTrizumPage.expectLoaded();
        await joinTrizumPage.joinWithCode(partyId);
        await whoAreYouPage.expectLoaded();
        await selectParticipantIdentity(bobSession.page, "Bob");
        await bobPartyPage.expectLoaded(partyId, partyName);
        await waitForDataSync(bobSession.page);
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
        await expect(aliceSession.page).toHaveURL(
          new RegExp(`/party/${partyId}/expense/[^/]+(?:\\?.*)?$`),
          {
            timeout: 30_000,
          },
        );

        expenseId = getExpenseIdFromUrl(aliceSession.page);

        await waitForDataSync(aliceSession.page);
        await expect
          .poll(() => readExpenseName(bobSession.page, expenseId), {
            timeout: 60_000,
          })
          .toBe(initialExpenseTitle);
        await bobPartyPage.expectExpenseInLog(initialExpenseTitle, amountText);
      });

      await test.step("Alice's edit draft updates Bob's editor in realtime", async () => {
        await aliceSession.goto(`/party/${partyId}/expense/${expenseId}/edit`);
        await bobSession.goto(`/party/${partyId}/expense/${expenseId}/edit`);

        await expect(aliceSession.page.getByRole("heading", { name: /Editing/ })).toBeVisible({
          timeout: 90_000,
        });
        await expect(bobSession.page.getByRole("heading", { name: /Editing/ })).toBeVisible({
          timeout: 90_000,
        });

        await aliceSession.page.getByLabel("Title").fill(aliceDraftExpenseTitle);
        await expect
          .poll(() => readExpenseDraftName(aliceSession.page, expenseId), {
            timeout: 10_000,
          })
          .toBe(aliceDraftExpenseTitle);
        await waitForDataSync(aliceSession.page);
        await expect
          .poll(() => readExpenseDraftName(bobSession.page, expenseId), {
            timeout: 60_000,
          })
          .toBe(aliceDraftExpenseTitle);
        await throwRouteErrorIfPresent(bobSession);

        await expect(bobSession.page.getByLabel("Title")).toHaveValue(aliceDraftExpenseTitle, {
          timeout: 30_000,
        });
      });

      await test.step("Bob's edit draft updates Alice's editor in realtime", async () => {
        await aliceSession.page.getByLabel("Title").blur();
        await bobSession.page.getByLabel("Title").fill(bobDraftExpenseTitle);
        await expect
          .poll(() => readExpenseDraftName(bobSession.page, expenseId), {
            timeout: 10_000,
          })
          .toBe(bobDraftExpenseTitle);
        await waitForDataSync(bobSession.page);
        await expect
          .poll(() => readExpenseDraftName(aliceSession.page, expenseId), {
            timeout: 60_000,
          })
          .toBe(bobDraftExpenseTitle);
        await throwRouteErrorIfPresent(aliceSession);

        await expect(aliceSession.page.getByLabel("Title")).toHaveValue(bobDraftExpenseTitle, {
          timeout: 30_000,
        });
      });

      await test.step("Bob saves the edit and Alice sees the committed expense", async () => {
        const alicePartyPage = new PartyPage(aliceSession.page);

        await bobSession.page.getByRole("button", { name: "Save" }).click();
        await expect(
          bobSession.page.getByRole("heading", { name: bobDraftExpenseTitle }),
        ).toBeVisible();
        await waitForDataSync(bobSession.page);
        await expect
          .poll(() => readExpenseName(aliceSession.page, expenseId), {
            timeout: 60_000,
          })
          .toBe(bobDraftExpenseTitle);

        await aliceSession.goto(`/party/${partyId}?tab=expenses`);
        await alicePartyPage.expectExpenseInLog(bobDraftExpenseTitle, amountText);
      });
    } finally {
      await attachDiagnostics(testInfo, aliceSession);
      await attachDiagnostics(testInfo, bobSession);
      await Promise.all([aliceSession.context.close(), bobSession.context.close()]);
    }
  });
});

type CollaborationSession = {
  context: BrowserContext;
  dbName: string;
  diagnostics: string[];
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
  const diagnostics: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      diagnostics.push(`[${message.type()}] ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    diagnostics.push(`[pageerror] ${error.message}`);
  });

  await context.route(isSentryUrl, async (route) => {
    await route.abort();
  });

  return {
    context,
    dbName,
    diagnostics,
    goto: (path) => page.goto(createOnlinePath(path, dbName)).then(() => undefined),
    page,
  };
}

async function attachDiagnostics(testInfo: TestInfo, session: CollaborationSession) {
  await captureRouteError(session);

  if (session.diagnostics.length === 0) {
    return;
  }

  await testInfo.attach(`${session.dbName}-diagnostics`, {
    body: session.diagnostics.join("\n"),
    contentType: "text/plain",
  });
}

async function captureRouteError(session: CollaborationSession) {
  const showErrorButton = session.page.getByRole("button", { name: /show error/i });

  try {
    if (!(await showErrorButton.isVisible({ timeout: 500 }))) {
      return;
    }

    await showErrorButton.click();
    session.diagnostics.push(`[route-error] ${await session.page.locator("body").innerText()}`);
  } catch {
    // The page may already be navigating or closed after a failure.
  }
}

async function throwRouteErrorIfPresent(session: CollaborationSession) {
  await captureRouteError(session);
  const routeError = session.diagnostics.find((entry) => entry.startsWith("[route-error]"));

  if (routeError) {
    throw new Error(routeError);
  }
}

function createOnlinePath(pathname: string, dbName: string) {
  const url = new URL(pathname, "http://trizum.local");
  url.searchParams.set("__internal_db_name", dbName);

  return `${url.pathname}${url.search}${url.hash}`;
}

function createCollaborationDbName(testInfo: TestInfo, label: string) {
  const testSlug = testInfo.testId.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 100);

  return `trizum-e2e-collab-${testInfo.project.name}-${testInfo.workerIndex}-${testInfo.retry}-${testSlug}-${crypto.randomUUID()}-${label}`;
}

function formatAmountText(amount: number) {
  return amount.toFixed(2).replace(".", ",");
}

async function selectParticipantIdentity(page: Page, participantName: string) {
  await page.getByRole("radio", { name: participantName }).click({ force: true });
  await page.getByRole("button", { name: /save|guardar/i }).click();
  await expect
    .poll(
      async () => {
        return new URL(page.url()).pathname.endsWith("/who");
      },
      { timeout: 30_000 },
    )
    .toBe(false);
}

type InternalExpenseSnapshot = {
  name?: string;
  __editCopy?: {
    name?: string;
  } | null;
};

type InternalPartySnapshot = {
  name?: string;
  participants?: Record<string, { name?: string }>;
};

async function waitForDataSync(page: Page, timeoutMs = 20_000) {
  await page.evaluate(async (timeout) => {
    const waitForSync = (
      window as typeof window & {
        __internal_waitForDataSync?: () => Promise<void>;
      }
    ).__internal_waitForDataSync;

    if (!waitForSync) {
      throw new Error("Internal data sync hook is not available");
    }

    await Promise.race([
      waitForSync(),
      new Promise<void>((resolve) => {
        setTimeout(() => resolve(), timeout);
      }),
    ]);
  }, timeoutMs);
}

async function readPartySnapshot(page: Page, partyId: string, mode: "cache" | "settled" = "cache") {
  return page.evaluate(
    async ({ currentPartyId, readMode }) => {
      function withReadTimeout<T>(promise: Promise<T>) {
        return Promise.race([
          promise,
          new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), 5_000);
          }),
        ]);
      }

      const reader = (
        window as typeof window & {
          __internal_readPartyState?: (
            partyId: string,
            mode?: "cache" | "settled",
          ) => Promise<unknown>;
        }
      ).__internal_readPartyState;

      if (!reader) {
        return null;
      }

      return (await withReadTimeout(
        reader(currentPartyId, readMode),
      )) as InternalPartySnapshot | null;
    },
    { currentPartyId: partyId, readMode: mode },
  );
}

async function readPartyParticipantNames(
  page: Page,
  partyId: string,
  mode: "cache" | "settled" = "cache",
) {
  const party = await readPartySnapshot(page, partyId, mode);

  return Object.values(party?.participants ?? {})
    .map((participant) => participant.name)
    .filter((name): name is string => typeof name === "string")
    .sort();
}

async function readExpenseDraftName(
  page: Page,
  expenseId: string,
  mode: "cache" | "settled" = "cache",
) {
  const expense = await readExpenseSnapshot(page, expenseId, mode);

  return expense?.__editCopy?.name ?? null;
}

async function readExpenseName(page: Page, expenseId: string, mode: "cache" | "settled" = "cache") {
  const expense = await readExpenseSnapshot(page, expenseId, mode);

  return expense?.name ?? null;
}

async function readExpenseSnapshot(
  page: Page,
  expenseId: string,
  mode: "cache" | "settled" = "cache",
) {
  return page.evaluate(
    async ({ currentExpenseId, readMode }) => {
      function withReadTimeout<T>(promise: Promise<T>) {
        return Promise.race([
          promise,
          new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), 5_000);
          }),
        ]);
      }

      const reader = (
        window as typeof window & {
          __internal_readExpenseState?: (
            expenseId: string,
            mode?: "cache" | "settled",
          ) => Promise<unknown>;
        }
      ).__internal_readExpenseState;

      if (!reader) {
        return null;
      }

      return (await withReadTimeout(
        reader(currentExpenseId, readMode),
      )) as InternalExpenseSnapshot | null;
    },
    { currentExpenseId: expenseId, readMode: mode },
  );
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
