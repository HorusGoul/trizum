import { expect, test } from "./harness/trizum.fixture";
import { HomePage } from "./pages/home.page";
import { defaultParticipants } from "./harness/scenarios";

test.describe("Home party management", () => {
  test("orders active parties by pinned and recent use, and moves archived parties to their own screen", async ({
    harness,
    page,
  }) => {
    const homePage = new HomePage(page);
    await harness.seedPartyList({});

    const partyIds = await page.evaluate(
      async ({ fixtures, memberParticipantId }) => {
        const internalWindow = window as Window & {
          __internal_createPartyFromMigrationData: (
            data: unknown,
          ) => Promise<string>;
          __internal_seedPartyListState: (seed: unknown) => Promise<unknown>;
        };
        const [pinnedFixture, recentFixture, archivedFixture] = fixtures;
        const pinnedPartyId =
          await internalWindow.__internal_createPartyFromMigrationData(
            pinnedFixture,
          );
        const recentPartyId =
          await internalWindow.__internal_createPartyFromMigrationData(
            recentFixture,
          );
        const archivedPartyId =
          await internalWindow.__internal_createPartyFromMigrationData(
            archivedFixture,
          );

        await internalWindow.__internal_seedPartyListState({
          username: "Harness User",
          phone: "",
          parties: {
            [pinnedPartyId]: true,
            [recentPartyId]: true,
            [archivedPartyId]: true,
          },
          pinnedParties: {
            [pinnedPartyId]: true,
          },
          archivedParties: {
            [archivedPartyId]: true,
          },
          lastUsedAt: {
            [pinnedPartyId]: 100,
            [recentPartyId]: 300,
            [archivedPartyId]: 200,
          },
          participantInParties: {
            [pinnedPartyId]: memberParticipantId,
            [recentPartyId]: memberParticipantId,
            [archivedPartyId]: memberParticipantId,
          },
        });

        return {
          pinnedPartyId,
          recentPartyId,
          archivedPartyId,
        };
      },
      {
        fixtures: [
          createNamedPartyFixture(
            "Pinned dinner club",
            "A standing monthly tab.",
          ),
          createNamedPartyFixture(
            "Recent ski trip",
            "Lift tickets, snacks, and gas.",
          ),
          createNamedPartyFixture(
            "Archived picnic",
            "Done and dusted, but still worth keeping.",
          ),
        ],
        memberParticipantId: defaultParticipants.blair.id,
      },
    );

    await test.step("show only active parties on the home screen", async () => {
      await harness.navigate("/");

      const partyCards = page.locator('[data-testid="party-list-card"]');

      await expect(partyCards).toHaveCount(2);
      await expect(partyCards.nth(0)).toContainText("Pinned dinner club");
      await expect(partyCards.nth(1)).toContainText("Recent ski trip");
      await expect(homePage.partyLink(/Archived picnic/)).toHaveCount(0);
    });

    await test.step("clicking the card surface still opens the party", async () => {
      const partyCards = page.locator('[data-testid="party-list-card"]');

      await partyCards.nth(1).click();
      await expect(page).toHaveURL(new RegExp(partyIds.recentPartyId));

      await harness.navigate("/");
      await expect(homePage.partyLink(/Recent ski trip/)).toBeVisible();
    });

    await test.step("list archived parties on the archived screen", async () => {
      await homePage.openArchivedParties();

      await expect(page).toHaveURL(/\/archived(?:\?.*)?$/);
      await expect(page.locator('[data-testid="party-list-card"]')).toHaveCount(
        1,
      );
      await expect(
        page.locator('[data-testid="party-list-card"]').nth(0),
      ).toContainText("Archived picnic");
      await expect(
        page.locator('[data-testid="party-list-card"]').nth(0),
      ).not.toContainText("Last used");
    });

    await test.step("restore an archived party back to the home screen", async () => {
      await page.getByRole("button", { name: "Party actions" }).click();
      await page.getByRole("menuitem", { name: "Restore to home" }).click();

      await expect(
        page.getByRole("heading", { name: "No archived parties" }),
      ).toBeVisible();

      await harness.navigate("/");

      const partyCards = page.locator('[data-testid="party-list-card"]');

      await expect(homePage.partyLink(/Archived picnic/)).toBeVisible();
      await expect(partyCards).toHaveCount(3);
      await expect(partyCards.nth(0)).toContainText("Pinned dinner club");
    });
  });
});

function createNamedPartyFixture(name: string, description: string) {
  return {
    party: {
      type: "party" as const,
      name,
      symbol: "🏕️",
      description,
      currency: "EUR" as const,
      participants: {
        [defaultParticipants.alex.id]: {
          ...defaultParticipants.alex,
        },
        [defaultParticipants.blair.id]: {
          ...defaultParticipants.blair,
        },
        [defaultParticipants.casey.id]: {
          ...defaultParticipants.casey,
        },
      },
    },
    expenses: [],
    photos: [],
  };
}
