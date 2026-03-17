import { expect, test as base, type Page } from "@playwright/test";

interface InternalHarnessWindow extends Window {
  __internal_createPartyFromMigrationData: (data: unknown) => Promise<string>;
  __internal_seedPartyListState: (seed: unknown) => Promise<{
    partyListId: string;
  }>;
}

interface PartyListSeed {
  username?: string;
  phone?: string;
  openLastPartyOnLaunch?: boolean;
  lastOpenedPartyId?: string | null;
  parties?: Record<string, true>;
  participantInParties?: Record<string, string>;
}

interface JoinedPartySeed {
  fixture: unknown;
  memberParticipantId: string;
  openLastPartyOnLaunch?: boolean;
}

interface JoinedPartyThroughUiSeed {
  fixture: unknown;
  participantName: string;
}

export interface BrowserHarness {
  goto(path?: string): Promise<void>;
  gotoHome(): Promise<void>;
  navigate(path: string): Promise<void>;
  gotoParty(partyId: string, tab?: "expenses" | "balances"): Promise<void>;
  seedParty(fixture: unknown): Promise<{
    joinCode: string;
    joinUrl: string;
    partyId: string;
  }>;
  seedPartyList(seed: PartyListSeed): Promise<{
    partyListId: string;
  }>;
  seedJoinableParty(fixture: unknown): Promise<{
    joinCode: string;
    joinUrl: string;
    partyId: string;
  }>;
  joinSeededParty(seed: JoinedPartyThroughUiSeed): Promise<{
    joinCode: string;
    joinUrl: string;
    partyId: string;
  }>;
  seedJoinedParty(seed: JoinedPartySeed): Promise<{
    joinCode: string;
    joinUrl: string;
    partyId: string;
  }>;
  selectParticipantIdentity(participantName: string): Promise<void>;
}

function createOfflinePath(pathname = "/") {
  const url = new URL(pathname, "http://trizum.local");
  url.searchParams.set("__internal_offline_only", "true");
  return `${url.pathname}${url.search}${url.hash}`;
}

function createBrowserHarness(page: Page): BrowserHarness {
  async function goto(path = "/") {
    await page.goto(createOfflinePath(path));
  }

  async function navigate(path: string) {
    const nextPath = createOfflinePath(path).replace(
      /\?__internal_offline_only=true$/,
      "",
    );
    const nextUrl = new URL(nextPath, "http://trizum.local");

    await page.evaluate((targetPath) => {
      const url = new URL(targetPath, window.location.origin);
      window.history.pushState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, nextPath);

    await expect
      .poll(async () => page.evaluate(() => window.location.pathname))
      .toBe(nextUrl.pathname);

    if (nextUrl.search) {
      await expect
        .poll(async () => page.evaluate(() => window.location.search))
        .toBe(nextUrl.search);
    }

    await expect
      .poll(async () => page.evaluate(() => window.location.hash))
      .toBe(nextUrl.hash);
  }

  async function waitForInternalHooks() {
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const internalWindow = window as Partial<InternalHarnessWindow>;
          return (
            typeof internalWindow.__internal_createPartyFromMigrationData ===
              "function" &&
            typeof internalWindow.__internal_seedPartyListState === "function"
          );
        });
      })
      .toBe(true);
  }

  async function bootstrapForSeeding() {
    await goto("/");
    await waitForInternalHooks();
  }

  function buildPartySeedResult(partyId: string) {
    return {
      joinCode: partyId,
      joinUrl: `/party/${partyId}`,
      partyId,
    };
  }

  async function seedParty(fixture: unknown) {
    await bootstrapForSeeding();

    const partyId = await page.evaluate(async (data) => {
      const internalWindow = window as InternalHarnessWindow;
      return internalWindow.__internal_createPartyFromMigrationData(data);
    }, fixture);

    return buildPartySeedResult(partyId);
  }

  async function seedPartyList(seed: PartyListSeed) {
    await bootstrapForSeeding();
    return writePartyList(seed);
  }

  async function seedJoinableParty(fixture: unknown) {
    return seedParty(fixture);
  }

  async function joinSeededParty({
    fixture,
    participantName,
  }: JoinedPartyThroughUiSeed) {
    const seededParty = await seedJoinableParty(fixture);

    await navigate("/join");
    await page.getByLabel("Link or code").fill(seededParty.joinCode);
    await page.getByRole("button", { name: "Join" }).click();
    await expect(
      page.getByRole("heading", { name: "Who are you?" }),
    ).toBeVisible();
    await selectParticipantIdentity(participantName);

    return seededParty;
  }

  async function seedJoinedParty({
    fixture,
    memberParticipantId,
    openLastPartyOnLaunch = false,
  }: JoinedPartySeed) {
    await bootstrapForSeeding();

    const seededParty = await createParty(fixture);

    await writePartyList({
      username: "Harness User",
      phone: "",
      openLastPartyOnLaunch,
      lastOpenedPartyId: openLastPartyOnLaunch ? seededParty.partyId : null,
      parties: {
        [seededParty.partyId]: true,
      },
      participantInParties: {
        [seededParty.partyId]: memberParticipantId,
      },
    });

    return buildPartySeedResult(seededParty);
  }

  async function gotoParty(
    partyId: string,
    tab: "expenses" | "balances" = "expenses",
  ) {
    await goto(`/party/${partyId}?tab=${tab}`);
  }

  async function selectParticipantIdentity(participantName: string) {
    await page.getByRole("radio", { name: participantName }).click({
      force: true,
    });
    await page.getByRole("button", { name: /save|guardar/i }).click();
  }

  async function createParty(fixture: unknown) {
    return page.evaluate(async (data) => {
      const internalWindow = window as InternalHarnessWindow;
      return internalWindow.__internal_createPartyFromMigrationData(data);
    }, fixture);
  }

  async function writePartyList(seed: PartyListSeed) {
    return page.evaluate(async (nextSeed) => {
      const internalWindow = window as InternalHarnessWindow;
      return internalWindow.__internal_seedPartyListState(nextSeed);
    }, seed);
  }

  return {
    goto,
    gotoHome: () => goto("/"),
    navigate,
    gotoParty,
    seedParty,
    seedPartyList,
    seedJoinableParty,
    joinSeededParty,
    seedJoinedParty,
    selectParticipantIdentity,
  };
}

export const test = base.extend<{
  harness: BrowserHarness;
}>({
  harness: async ({ page }, use) => {
    await use(createBrowserHarness(page));
  },
});

test.use({
  serviceWorkers: "block",
});

export { expect };
