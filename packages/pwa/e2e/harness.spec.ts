import { ExpenseDetailPage } from "./pages/expense-detail.page";
import { ExpenseEditorPage } from "./pages/expense-editor.page";
import { ExpensePage } from "./pages/expense.page";
import { HomePage } from "./pages/home.page";
import { JoinTrizumPage } from "./pages/join-trizum.page";
import { NewTrizumPage } from "./pages/new-trizum.page";
import { PartyPage, balanceCalculationTimeout } from "./pages/party.page";
import { PayPage } from "./pages/pay.page";
import { WhoAreYouPage } from "./pages/who-are-you.page";
import {
  createPartyActivationScenario,
  createImbalancedPartyFixture,
  createPartyFixture,
  createSettlementPartyFixture,
  defaultParticipants,
  expenseEntryJourney,
} from "./harness/scenarios";
import { expect, test } from "./harness/trizum.fixture";

function formatAmountText(amount: number) {
  return amount.toFixed(2).replace(".", ",");
}

test.describe("Browser harness", () => {
  test("starts every journey from a fresh offline home screen", async ({ harness, page }) => {
    await harness.gotoHome();

    await expect(page).toHaveURL(/\/\?__internal_offline_only=true$/);
    await expect(page.getByRole("heading", { name: "Split expenses, stay even." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create a Party" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Keep every party in sync/ })).toBeVisible();
  });

  test("opens cloud sign-in from the home screen", async ({ harness, page }) => {
    const homePage = new HomePage(page);

    await page.setViewportSize({ width: 390, height: 700 });
    await harness.gotoHome();
    const homeHeading = page.getByRole("heading", { name: "Split expenses, stay even." });
    await expect(homeHeading).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({
      content: "body::after { content: ''; display: block; height: 240px; }",
    });
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    const scrollYBeforeSignIn = await page.evaluate(() => window.scrollY);
    expect(scrollYBeforeSignIn).toBeGreaterThan(0);

    const headingBeforeSignIn = await homeHeading.boundingBox();
    const homeHeadingElement = await homeHeading.elementHandle();
    if (!homeHeadingElement) {
      throw new Error("Expected the home heading to be mounted before opening sign-in");
    }

    await homePage.openCloudSync();

    await expect(page).toHaveURL(/\/settings\/cloud-sync$/);
    await expect(page.getByRole("dialog", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign in to trizum cloud" })).toBeVisible();
    await expect(page.locator('button[aria-label="Profile and app menu"]')).toHaveCount(1);
    await expect(page.locator("html")).toHaveCSS("scrollbar-gutter", "stable");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollYBeforeSignIn);

    const headingBehindSignIn = await page.locator("main h2").boundingBox();
    expect(headingBehindSignIn).toEqual(headingBeforeSignIn);
    await expect(
      homeHeadingElement.evaluate((element) => element === document.querySelector("main h2")),
    ).resolves.toBe(true);

    await page.getByRole("button", { name: "Close sign-in" }).click();
    await expect(page).toHaveURL(/\/\?__internal_offline_only=true$/);
  });

  test("returns straight to home after signing in", async ({ harness, page }) => {
    const homePage = new HomePage(page);
    const user = {
      createdAt: new Date().toISOString(),
      email: "alex@example.com",
      emailVerified: true,
      id: "test-user",
      image: null,
      name: "Alex",
      updatedAt: new Date().toISOString(),
    };
    let isSignedIn = false;
    let cloudPartyListId = "";

    await page.route("**/api/auth/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;

      if (pathname.endsWith("/get-session")) {
        await route.fulfill({
          json: isSignedIn
            ? {
                session: {
                  createdAt: new Date().toISOString(),
                  expiresAt: new Date(Date.now() + 60_000).toISOString(),
                  id: "test-session",
                  token: "test-token",
                  updatedAt: new Date().toISOString(),
                  userId: user.id,
                },
                user,
              }
            : null,
        });
        return;
      }

      if (pathname.endsWith("/sign-in/email")) {
        isSignedIn = true;
        await route.fulfill({ json: { redirect: false, token: "test-token", user } });
        return;
      }

      if (pathname.endsWith("/list-accounts")) {
        await route.fulfill({ json: [] });
        return;
      }

      await route.fallback();
    });
    await page.route("**/api/cloud-sync/settings", async (route) => {
      await route.fulfill({
        json: {
          settings: {
            partyListDocumentId: cloudPartyListId,
            updatedAt: Date.now(),
          },
        },
      });
    });

    const cloudParty = await harness.seedParty(createPartyFixture());
    const localPartyListId = (await harness.readPartyList()).partyListId;
    cloudPartyListId = (
      await harness.createDeferredPartyList({
        username: "Cloud User",
        parties: { [cloudParty.partyId]: true },
        participantInParties: {
          [cloudParty.partyId]: defaultParticipants.blair.id,
        },
      })
    ).partyListId;
    expect(cloudPartyListId).not.toBe(localPartyListId);
    await homePage.menuButton.click();
    await expect(page.getByRole("menuitem", { name: "Sign in to trizum cloud" })).toBeVisible();
    await page.keyboard.press("Escape");
    await homePage.openCloudSync();
    await page.getByRole("button", { name: "Sign in with password" }).click();
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill("test-password");
    await page.evaluate(() => {
      const testWindow = window as Window & { __cloudSettingsRendered?: boolean };
      testWindow.__cloudSettingsRendered = false;
      new MutationObserver(() => {
        const cloudSettingsHeading = [...document.querySelectorAll("h1")].some(
          (heading) => heading.textContent?.trim() === "trizum cloud",
        );
        testWindow.__cloudSettingsRendered ||= cloudSettingsHeading;
      }).observe(document.body, { childList: true, subtree: true });
    });

    await page.getByRole("button", { name: "Sign in with password" }).click();

    await expect(page.locator("p").getByText("Signed in", { exact: true })).toBeVisible();
    await expect
      .poll(() => harness.getDocumentState(cloudPartyListId))
      .toMatch(/^(loading|requesting|unavailable)$/);
    await expect(page).toHaveURL(/\/settings\/cloud-sync$/);
    await expect(homePage.partyCard(/Weekend trip/)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("partyListId"))).toBe(localPartyListId);

    await harness.releaseDeferredPartyList(cloudPartyListId);

    await expect.poll(() => page.evaluate(() => window.location.pathname)).toBe("/");
    await homePage.expectPartyVisible(/Weekend trip/);
    const cloudPartyCard = homePage.partyCard(/Weekend trip/);
    await cloudPartyCard.hover();
    await cloudPartyCard.getByRole("button", { name: "Party actions" }).click();
    await page.getByRole("menuitem", { name: "Pin party" }).click();
    await expect
      .poll(async () => (await harness.readPartyList()).pinnedParties[cloudParty.partyId])
      .toBe(true);
    await homePage.menuButton.click();
    await expect(page.getByRole("menuitem", { name: "Manage trizum cloud" })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as Window & { __cloudSettingsRendered?: boolean }).__cloudSettingsRendered,
        ),
      )
      .toBe(false);
  });

  test("initializes the auth session on party routes", async ({ harness, page }) => {
    const partyPage = new PartyPage(page);
    let sessionRequestCount = 0;

    await page.route("**/api/auth/get-session", async (route) => {
      sessionRequestCount += 1;
      await route.fulfill({ json: null });
    });

    const seededParty = await harness.seedJoinedParty({
      fixture: createPartyFixture(),
      memberParticipantId: defaultParticipants.blair.id,
    });
    sessionRequestCount = 0;

    await harness.gotoParty(seededParty.partyId);
    await partyPage.expectLoaded(seededParty.partyId, "Weekend trip");
    await expect.poll(() => sessionRequestCount).toBeGreaterThan(0);
  });

  test("keeps an open party bound to the list that admitted it", async ({
    context,
    harness,
    page,
  }) => {
    const partyPage = new PartyPage(page);
    const activeParty = await harness.seedJoinedParty({
      fixture: createPartyFixture(),
      memberParticipantId: defaultParticipants.blair.id,
    });
    const replacementPartyList = await harness.createDeferredPartyList({
      username: "Another tab",
    });
    await harness.releaseDeferredPartyList(replacementPartyList.partyListId);

    await harness.gotoParty(activeParty.partyId);
    await partyPage.expectLoaded(activeParty.partyId, "Weekend trip");

    const otherPage = await context.newPage();
    await otherPage.goto("/?__internal_offline_only=true");
    await otherPage.evaluate((partyListId) => {
      localStorage.setItem("partyListId", partyListId);
    }, replacementPartyList.partyListId);
    await otherPage.close();

    await partyPage.openBalances();
    await partyPage.expectLoaded(activeParty.partyId, "Weekend trip");
  });

  test("can reopen an existing persisted party from the home screen", async ({ harness, page }) => {
    const homePage = new HomePage(page);
    const seededParty = await harness.joinSeededParty({
      fixture: createImbalancedPartyFixture(),
      participantName: defaultParticipants.blair.name,
    });

    await test.step("load the home screen with persisted membership", async () => {
      await harness.gotoHome();

      await expect(page).toHaveURL(/\/\?__internal_offline_only=true$/);
      await homePage.expectPartyVisible(/Weekend trip/);
    });

    await test.step("open the existing party from the home list", async () => {
      await homePage.openParty(/Weekend trip/);

      await expect(page).toHaveURL(
        new RegExp(`/party/${seededParty.partyId}\\?tab=expenses(?:&.*)?$`),
      );
      await expect(page.getByRole("heading", { name: /Weekend trip/ })).toBeVisible();
      await expect(page.getByText("Cabin groceries")).toBeVisible();
    });
  });

  test("can exercise join flow without depending on live sync", async ({ harness, page }) => {
    const joinPage = new JoinTrizumPage(page);
    const seededParty = await harness.seedJoinableParty(createPartyFixture());
    const inviteLink = `https://trizum.app${seededParty.joinUrl}`;
    const redirectedPartyPath = `/party/${seededParty.partyId}`;
    const expectedRedirectTarget = `${redirectedPartyPath}?tab=expenses`;

    await test.step("start from a browser state that does not already belong to the party", async () => {
      const partyList = await harness.readPartyList();

      expect(partyList.parties[seededParty.partyId]).toBeUndefined();
      expect(partyList.participantInParties[seededParty.partyId]).toBeUndefined();
    });

    await test.step("enter a valid invite link and land on participant selection", async () => {
      await harness.navigate("/join");
      await joinPage.expectLoaded();
      await joinPage.joinWithLinkOrCode(inviteLink);

      await expect
        .poll(async () => page.evaluate(() => window.location.pathname))
        .toBe(`${redirectedPartyPath}/who`);
      await expect
        .poll(async () => page.evaluate(() => window.location.search))
        .toBe(`?redirectTo=${encodeURIComponent(expectedRedirectTarget)}`);
      await expect(page.getByRole("heading", { name: "Who are you?" })).toBeVisible();
    });

    await test.step("select an identity and save the membership", async () => {
      await harness.selectParticipantIdentity(defaultParticipants.blair.name);

      await expect
        .poll(async () => page.evaluate(() => window.location.pathname))
        .toBe(redirectedPartyPath);
      await expect
        .poll(async () => page.evaluate(() => window.location.search))
        .toBe("?tab=expenses");
      await expect(page.getByRole("heading", { name: /Weekend trip/ })).toBeVisible();

      const partyList = await harness.readPartyList();

      expect(partyList.parties[seededParty.partyId]).toBe(true);
      expect(partyList.participantInParties[seededParty.partyId]).toBe(
        defaultParticipants.blair.id,
      );
    });

    await test.step("reopen the party from persisted offline state", async () => {
      await harness.gotoParty(seededParty.partyId);

      await expect
        .poll(async () => page.evaluate(() => window.location.pathname))
        .toBe(redirectedPartyPath);
      await expect
        .poll(async () =>
          page.evaluate(() => {
            const search = new URLSearchParams(window.location.search);
            return {
              tab: search.get("tab"),
              offlineOnly: search.get("__internal_offline_only"),
            };
          }),
        )
        .toEqual({
          tab: "expenses",
          offlineOnly: "true",
        });
      await expect(page.getByRole("heading", { name: /Weekend trip/ })).toBeVisible();
    });
  });

  test("can create a party and complete participant selection from empty state", async ({
    harness,
    page,
  }) => {
    const newTrizumPage = new NewTrizumPage(page);
    const whoAreYouPage = new WhoAreYouPage(page);
    let partyId = "";

    await test.step("create a new party from /new", async () => {
      await harness.goto("/new");
      await newTrizumPage.expectLoaded();
      await newTrizumPage.createParty({
        name: createPartyActivationScenario.partyName,
        participants: createPartyActivationScenario.participants,
      });
    });

    await test.step("redirect through participant selection", async () => {
      await whoAreYouPage.expectLoaded();

      const partyPageUrl = new URL(page.url());
      const match = partyPageUrl.pathname.match(/^\/party\/([^/]+)\/who$/);

      expect(match?.[1]).toBeTruthy();
      partyId = match![1];

      await expect(
        whoAreYouPage.participantOption(createPartyActivationScenario.selectedParticipantName),
      ).toBeVisible();
    });

    await test.step("save the selected participant identity", async () => {
      await whoAreYouPage.selectParticipant(createPartyActivationScenario.selectedParticipantName);
    });

    await test.step("land on the party expenses page", async () => {
      await expect(page).toHaveURL(new RegExp(`/party/${partyId}\\?tab=expenses(?:&.*)?$`));
      await expect(
        page.getByRole("heading", {
          name: new RegExp(createPartyActivationScenario.partyName),
        }),
      ).toBeVisible();
      await expect(page.getByRole("tab", { name: "Expenses" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Expenses" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });
  });

  test("can add an expense in an existing party and see it in detail and list views", async ({
    harness,
    page,
  }) => {
    const partyPage = new PartyPage(page);
    const expenseEditorPage = new ExpenseEditorPage(page);
    const expenseDetailPage = new ExpenseDetailPage(page);
    const expectedAmountText = formatAmountText(expenseEntryJourney.amount);

    const seededParty = await harness.joinSeededParty({
      fixture: createPartyFixture(),
      participantName: expenseEntryJourney.selectedParticipantName,
    });

    await partyPage.expectLoaded(seededParty.partyId, "Weekend trip");
    await partyPage.openAddExpense();

    await expenseEditorPage.expectLoaded();
    await expenseEditorPage.fillTitle(expenseEntryJourney.title);
    await expenseEditorPage.fillAmount(expenseEntryJourney.amount);

    for (const participantName of expenseEntryJourney.participantNames) {
      await expenseEditorPage.setParticipantIncluded(participantName, true);
    }

    await expenseEditorPage.save();

    await expenseDetailPage.expectLoaded(
      seededParty.partyId,
      expenseEntryJourney.title,
      expectedAmountText,
    );
    await expenseDetailPage.goBack();

    await partyPage.expectLoaded(seededParty.partyId, "Weekend trip");
    await partyPage.expectExpenseInLog(expenseEntryJourney.title, expectedAmountText);
  });

  test("can seed an imbalanced party for balances journeys", async ({ harness, page }) => {
    await harness.joinSeededParty({
      fixture: createImbalancedPartyFixture(),
      participantName: defaultParticipants.blair.name,
    });

    await page.getByRole("tab", { name: "Balances" }).click();

    await expect(page.getByRole("heading", { name: "How should I balance?" })).toBeVisible({
      timeout: balanceCalculationTimeout,
    });
    await expect(page.getByText("You owe money to people")).toBeVisible({
      timeout: balanceCalculationTimeout,
    });
    await expect(page.getByRole("button", { name: "Pay" })).toBeVisible({
      timeout: balanceCalculationTimeout,
    });
  });

  test("can settle a balance from the balances tab", async ({ harness, page }) => {
    const expensePage = new ExpensePage(page);
    const partyPage = new PartyPage(page);
    const payPage = new PayPage(page);
    const action = {
      actionLabel: "Pay" as const,
      fromLabel: `${defaultParticipants.blair.name} (me)`,
      toLabel: defaultParticipants.alex.name,
    };

    const seededParty =
      await test.step("seed a deterministic party with one unsettled balance", async () =>
        harness.joinSeededParty({
          fixture: createSettlementPartyFixture(),
          participantName: defaultParticipants.blair.name,
        }));

    await test.step("open Balances and confirm the settlement action is rendered", async () => {
      await partyPage.openBalances();
      await partyPage.expectSettlementActionVisible(action);
    });

    await test.step("open the payment route for that settlement", async () => {
      await partyPage.openSettlementAction(action);
      await payPage.expectLoaded("Pay");
      await payPage.expectSearchParams({
        amount: "3000",
        fromId: defaultParticipants.blair.id,
        toId: defaultParticipants.alex.id,
      });
    });

    await test.step("complete the settlement and land on the transfer expense", async () => {
      await payPage.completeSettlement();
      await expensePage.expectLoaded(`Paid debt to ${defaultParticipants.alex.name}`);
    });

    await test.step("return to Balances and confirm the prior settlement action is gone", async () => {
      await page.goBack();
      await expect(page).toHaveURL(
        new RegExp(`/party/${seededParty.partyId}\\?tab=balances(?:&.*)?$`),
      );
      await harness.recalculatePartyBalances(seededParty.partyId);
      await partyPage.expectSettlementActionRemoved(action);
      await partyPage.expectFullySettled();
    });
  });
});
