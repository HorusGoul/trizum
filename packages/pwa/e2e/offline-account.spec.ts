import { expect, test } from "./harness/trizum.fixture";
import { HomePage } from "./pages/home.page";

test("keeps a remembered account after an offline reload and clears a revoked session on reconnect", async ({
  harness,
  page,
}) => {
  let sessionState: "signed-in" | "offline" | "signed-out" = "signed-in";
  const user = {
    id: "offline-account",
    name: "Alex",
    email: "alex@example.com",
    emailVerified: true,
    image: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await page.route("**/api/auth/get-session**", async (route) => {
    if (sessionState === "offline") {
      await route.abort("internetdisconnected");
      return;
    }
    await route.fulfill({
      json: sessionState === "signed-in" ? { user, session: { userId: user.id } } : null,
    });
  });
  await page.route("**/api/auth/list-accounts", (route) => route.fulfill({ json: [] }));
  await harness.gotoHome();
  const home = new HomePage(page);
  await home.menuButton.click();
  await expect(page.getByRole("menuitem", { name: "Manage trizum cloud" })).toBeVisible();

  sessionState = "offline";
  await page.reload();
  await home.menuButton.click();
  await expect(page.getByRole("menuitem", { name: "Manage trizum cloud" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Manage trizum cloud" }).click();
  await expect(page.getByText(user.email, { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(
    "Working offline. Your account will refresh when you reconnect.",
  );
  await expect(page.getByRole("dialog", { name: "Sign in", exact: true })).toBeHidden();

  sessionState = "signed-out";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("dialog", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByText(user.email, { exact: true })).toBeHidden();
  await expect(page.getByRole("status")).toBeHidden();
});
