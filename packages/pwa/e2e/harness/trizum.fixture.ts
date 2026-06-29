import { expect, test as base, type Page } from "@playwright/test";

export interface InternalHarnessWindow extends Window {
  __internal_createPartyFromMigrationData: (data: unknown) => Promise<string>;
  __internal_seedPartyListState: (seed: unknown) => Promise<{
    partyListId: string;
  }>;
  __internal_readPartyListState: () => Promise<{
    partyListId: string;
    lastOpenedPartyId: string | null;
    parties: Record<string, true | undefined>;
    pinnedParties: Record<string, true | undefined>;
    archivedParties: Record<string, true | undefined>;
    lastUsedAt: Record<string, number | undefined>;
    participantInParties: Record<string, string>;
  }>;
  __internal_recalculatePartyBalances: (partyId: string) => Promise<boolean>;
}

interface PartyListSeed {
  username?: string;
  phone?: string;
  openLastPartyOnLaunch?: boolean;
  lastOpenedPartyId?: string | null;
  parties?: Record<string, true>;
  pinnedParties?: Record<string, true>;
  archivedParties?: Record<string, true>;
  lastUsedAt?: Record<string, number>;
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

interface PartyListSnapshot {
  partyListId: string;
  lastOpenedPartyId: string | null;
  parties: Record<string, true | undefined>;
  pinnedParties: Record<string, true | undefined>;
  archivedParties: Record<string, true | undefined>;
  lastUsedAt: Record<string, number | undefined>;
  participantInParties: Record<string, string>;
}

export interface BrowserHarness {
  goto(path?: string): Promise<void>;
  gotoHome(): Promise<void>;
  navigate(path: string): Promise<void>;
  gotoParty(partyId: string, tab?: "expenses" | "balances" | "stats"): Promise<void>;
  seedParty(fixture: unknown): Promise<{
    joinCode: string;
    joinUrl: string;
    partyId: string;
  }>;
  seedParties(fixtures: unknown[]): Promise<
    {
      joinCode: string;
      joinUrl: string;
      partyId: string;
    }[]
  >;
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
  recalculatePartyBalances(partyId: string): Promise<void>;
  readPartyList(): Promise<PartyListSnapshot>;
  selectParticipantIdentity(participantName: string): Promise<void>;
}

function createOfflinePath(pathname = "/") {
  const url = new URL(pathname, "http://trizum.local");
  url.searchParams.set("__internal_offline_only", "true");
  return `${url.pathname}${url.search}${url.hash}`;
}

function isSentryUrl(url: URL) {
  return url.hostname === "sentry.io" || url.hostname.endsWith(".sentry.io");
}

function createBrowserHarness(page: Page): BrowserHarness {
  async function hasInternalHooks() {
    return page
      .evaluate(() => {
        const internalWindow = window as Partial<InternalHarnessWindow>;
        return (
          typeof internalWindow.__internal_createPartyFromMigrationData === "function" &&
          typeof internalWindow.__internal_seedPartyListState === "function" &&
          typeof internalWindow.__internal_readPartyListState === "function" &&
          typeof internalWindow.__internal_recalculatePartyBalances === "function"
        );
      })
      .catch(() => false);
  }

  async function goto(path = "/") {
    await page.goto(createOfflinePath(path));
  }

  async function navigate(path: string) {
    const nextUrl = new URL(createOfflinePath(path), "http://trizum.local");
    nextUrl.searchParams.delete("__internal_offline_only");
    const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;

    await page.evaluate((targetPath) => {
      const url = new URL(targetPath, window.location.origin);
      window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
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

    await expect.poll(async () => page.evaluate(() => window.location.hash)).toBe(nextUrl.hash);
  }

  async function waitForInternalHooks() {
    await expect
      .poll(async () => {
        return hasInternalHooks();
      })
      .toBe(true);
  }

  async function bootstrapForSeeding() {
    if (!(await hasInternalHooks())) {
      await goto("/");
    }

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

    const partyId = await createPartyWithRecalculatedBalances(fixture);

    return buildPartySeedResult(partyId);
  }

  async function seedParties(fixtures: unknown[]) {
    await bootstrapForSeeding();

    const partyIds: string[] = [];

    for (const fixture of fixtures) {
      partyIds.push(await createPartyWithRecalculatedBalances(fixture));
    }

    return partyIds.map(buildPartySeedResult);
  }

  async function seedPartyList(seed: PartyListSeed) {
    await bootstrapForSeeding();
    return writePartyList(seed);
  }

  async function seedJoinableParty(fixture: unknown) {
    return seedParty(fixture);
  }

  async function joinSeededParty({ fixture, participantName }: JoinedPartyThroughUiSeed) {
    const seededParty = await seedJoinableParty(fixture);

    await navigate("/join");
    await page.getByLabel("Link or code").fill(seededParty.joinCode);
    await page.getByRole("button", { name: "Join" }).click();
    await expect(page.getByRole("heading", { name: "Who are you?" })).toBeVisible();
    await selectParticipantIdentity(participantName);
    await expect
      .poll(async () => page.evaluate(() => window.location.pathname))
      .toBe(`/party/${seededParty.partyId}`);
    await expect
      .poll(async () => page.evaluate(() => new URLSearchParams(window.location.search).get("tab")))
      .toBe("expenses");
    await expect
      .poll(async () => {
        const partyList = await readPartyList();
        return partyList.parties[seededParty.partyId];
      })
      .toBe(true);

    return seededParty;
  }

  async function seedJoinedParty({
    fixture,
    memberParticipantId,
    openLastPartyOnLaunch = false,
  }: JoinedPartySeed) {
    await bootstrapForSeeding();

    const partyId = await createPartyWithRecalculatedBalances(fixture);

    await writePartyList({
      username: "Harness User",
      phone: "",
      openLastPartyOnLaunch,
      lastOpenedPartyId: openLastPartyOnLaunch ? partyId : null,
      parties: {
        [partyId]: true,
      },
      participantInParties: {
        [partyId]: memberParticipantId,
      },
    });

    return buildPartySeedResult(partyId);
  }

  async function readPartyList() {
    await waitForInternalHooks();

    return page.evaluate(async () => {
      const internalWindow = window as unknown as InternalHarnessWindow;
      return internalWindow.__internal_readPartyListState();
    });
  }

  async function gotoParty(partyId: string, tab: "expenses" | "balances" | "stats" = "expenses") {
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
      const internalWindow = window as unknown as InternalHarnessWindow;
      return internalWindow.__internal_createPartyFromMigrationData(data);
    }, fixture);
  }

  async function createPartyWithRecalculatedBalances(fixture: unknown) {
    const partyId = await createParty(fixture);
    await recalculatePartyBalances(partyId);

    return partyId;
  }

  async function recalculatePartyBalances(partyId: string) {
    await waitForInternalHooks();

    await page.evaluate(async (nextPartyId) => {
      const internalWindow = window as unknown as InternalHarnessWindow;
      await internalWindow.__internal_recalculatePartyBalances(nextPartyId);
    }, partyId);
  }

  async function writePartyList(seed: PartyListSeed) {
    return page.evaluate(async (nextSeed) => {
      const internalWindow = window as unknown as InternalHarnessWindow;
      return internalWindow.__internal_seedPartyListState(nextSeed);
    }, seed);
  }

  return {
    goto,
    gotoHome: () => goto("/"),
    navigate,
    gotoParty,
    seedParty,
    seedParties,
    seedPartyList,
    seedJoinableParty,
    joinSeededParty,
    seedJoinedParty,
    recalculatePartyBalances,
    readPartyList,
    selectParticipantIdentity,
  };
}

export const test = base.extend<{
  harness: BrowserHarness;
}>({
  context: async ({ context }, applyContext) => {
    await context.route(isSentryUrl, async (route) => {
      await route.abort();
    });

    await applyContext(context);
  },
  harness: async ({ page }, applyHarness) => {
    await applyHarness(createBrowserHarness(page));
  },
});

test.use({
  serviceWorkers: "block",
});

export { expect };
