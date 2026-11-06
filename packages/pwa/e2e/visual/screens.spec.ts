import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, type Route } from "@playwright/test";
import { createBrowserHarness, test, type BrowserHarness } from "../harness/trizum.fixture";
import { createImbalancedPartyFixture, defaultParticipants } from "../harness/scenarios";

type Screen =
  | "home"
  | "create-party"
  | "user-settings"
  | "expenses"
  | "balances"
  | "party-settings"
  | "expense-detail"
  | "expense-form"
  | "party-menu";

const screens: Screen[] = [
  "home",
  "create-party",
  "user-settings",
  "expenses",
  "balances",
  "party-settings",
  "expense-detail",
  "expense-form",
  "party-menu",
];

const fixedTime = new Date("2026-02-15T12:00:00Z");

async function signedOutSession(route: Route) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "null",
    headers: {
      "access-control-allow-origin": route.request().headers().origin ?? "*",
      "access-control-allow-credentials": "true",
    },
  });
}

async function stableScreenshot(page: Page) {
  let previous = await page.screenshot({
    animations: "disabled",
    caret: "hide",
    fullPage: true,
    scale: "css",
  });

  await expect
    .poll(
      async () => {
        const next = await page.screenshot({
          animations: "disabled",
          caret: "hide",
          fullPage: true,
          scale: "css",
        });

        const stable = next.equals(previous);
        previous = next;

        return stable;
      },
      { intervals: [100], timeout: 10_000 },
    )
    .toBe(true);

  return previous;
}

async function prepare(page: Page, harness: BrowserHarness, screen: Screen, locale: "en" | "es") {
  await page.bringToFront();

  const spriteResponse = page.waitForResponse(
    (response) => response.url().includes("iconSprite") && response.url().endsWith(".svg"),
  );

  await page.clock.setFixedTime(fixedTime);
  const partyScreen = !["home", "create-party", "user-settings"].includes(screen);
  let partyId: string | undefined;

  if (partyScreen) {
    const party = await harness.seedJoinedParty({
      fixture: createImbalancedPartyFixture(),
      memberParticipantId: defaultParticipants.blair.id,
    });

    partyId = party.partyId;
    await page.evaluate(
      async ({ partyId, locale }) => {
        await window.__internal_seedPartyListState({
          username: "Alex Rivera",
          phone: "",
          locale,
          hue: locale === "es" ? 150 : 250,
          autoOpenCalculator: false,
          parties: { [partyId]: true as const },
          participantInParties: { [partyId]: "participant-blair" },
        });
      },
      { partyId, locale },
    );
  } else {
    await harness.seedPartyList({
      username: "Alex Rivera",
      phone: "",
      locale,
      hue: locale === "es" ? 150 : 250,
      autoOpenCalculator: false,
    });
  }

  if (screen === "home") await harness.gotoHome();
  else if (screen === "create-party") await harness.goto("/new");
  else if (screen === "user-settings") await harness.goto("/settings");
  else {
    if (!partyId) throw new Error("Party screen needs a seeded party");

    if (screen === "balances") await harness.gotoParty(partyId, "balances");
    else if (screen === "party-settings") await harness.goto(`/party/${partyId}/settings`);
    else if (screen === "expense-form") await harness.goto(`/party/${partyId}/add`);
    else {
      await harness.gotoParty(partyId);
      await expect(page.getByText("Cabin groceries").first()).toBeVisible();

      if (screen === "expense-detail")
        await page.getByRole("link").filter({ hasText: "Cabin groceries" }).click();

      if (screen === "party-menu") {
        // Positioning must measure the same settled trigger on both versions.
        // Otherwise WebKit can anchor before or after the press-scale transition.
        await page.addStyleTag({
          content: "*, *::before, *::after { transition: none !important; }",
        });
        await page.getByRole("button", { name: /^(Menu|Menú)$/ }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
      }
    }
  }

  const labels =
    locale === "es"
      ? {
          home: "Reparte gastos, mantén las cuentas claras.",
          create: "Nuevo trizum",
          settings: "Configuración",
          partySettings: "Configuración del Grupo",
          expense: "Nuevo gasto",
          balances: "Balance",
        }
      : {
          home: "Split expenses, stay even.",
          create: "New trizum",
          settings: "Settings",
          partySettings: "Party Settings",
          expense: "New expense",
          balances: "Balances",
        };

  if (screen === "party-menu")
    await expect(page.getByRole("dialog")).toContainText(labels.settings);
  else {
    const heading =
      screen === "home"
        ? labels.home
        : screen === "create-party"
          ? labels.create
          : screen === "user-settings"
            ? labels.settings
            : screen === "party-settings"
              ? labels.partySettings
              : screen === "expense-form"
                ? labels.expense
                : screen === "expense-detail"
                  ? "Cabin groceries"
                  : /Weekend trip/;

    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }

  if (screen === "balances") {
    await expect(page.getByRole("tab", { name: labels.balances })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByRole("heading", {
        name: locale === "es" ? "¿Cómo debería equilibrar?" : "How should I balance?",
      }),
    ).toBeVisible();
  }

  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("[data-entering], [data-exiting]")).toHaveCount(0);
  // SVG <use> loads are not consistently exposed by Resource Timing in WebKit.
  const sprite = await spriteResponse;
  expect(sprite.ok()).toBe(true);
  expect(await sprite.finished()).toBeNull();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}

for (const locale of ["en", "es"] as const) {
  test.describe(locale, () => {
    test.use({ locale });

    for (const screen of screens) {
      test(`${screen} matches origin/main`, async ({
        page,
        browser,
        viewport,
        isMobile,
        hasTouch,
      }, testInfo) => {
        if (testInfo.config.updateSnapshots !== "none") {
          throw new Error(
            "Live reference comparisons cannot update snapshots; review the main/branch diff instead.",
          );
        }

        const referenceURL = process.env.PLAYWRIGHT_REFERENCE_URL;

        if (!referenceURL) throw new Error("Missing reference URL");

        const referenceContext = await browser.newContext({
          baseURL: referenceURL,
          viewport,
          isMobile,
          hasTouch,
          deviceScaleFactor: 1,
          locale,
          timezoneId: "UTC",
          colorScheme: "dark",
          reducedMotion: "reduce",
          serviceWorkers: "block",
        });

        await referenceContext.route(/sentry\.(?:io|dev)/, (route) => route.abort());
        const referencePage = await referenceContext.newPage();
        await page.route("**/api/auth/get-session**", signedOutSession);
        await referencePage.route("**/api/auth/get-session**", signedOutSession);

        try {
          await prepare(referencePage, createBrowserHarness(referencePage), screen, locale);
          // Stabilize the reference itself before using it as the live baseline.
          const referenceImage = await stableScreenshot(referencePage);
          const baseline = testInfo.snapshotPath("screen.png");
          await mkdir(path.dirname(baseline), { recursive: true });
          await writeFile(baseline, referenceImage);
          await writeFile(testInfo.outputPath("main.png"), referenceImage);
          await testInfo.attach("origin-main", {
            path: testInfo.outputPath("main.png"),
            contentType: "image/png",
          });
          await prepare(page, createBrowserHarness(page), screen, locale);

          const candidateImage = await stableScreenshot(page);
          await writeFile(testInfo.outputPath("branch.png"), candidateImage);
          await testInfo.attach("design-system-branch", {
            path: testInfo.outputPath("branch.png"),
            contentType: "image/png",
          });
          expect(candidateImage).toMatchSnapshot("screen.png", {
            maxDiffPixels: 0,
            threshold: 0.1,
          });
        } finally {
          await referenceContext.close();
        }
      });
    }
  });
}
