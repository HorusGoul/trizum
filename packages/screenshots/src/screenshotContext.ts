import type { Browser, BrowserContextOptions } from "playwright";

/** Keep captures out of production analytics, including when capturing an older app build. */
export async function createScreenshotContext(
  browser: Pick<Browser, "newContext">,
  options: BrowserContextOptions,
) {
  const context = await browser.newContext({
    ...options,
    userAgent: `${options.userAgent ?? ""} Playwright/trizum-screenshots`.trim(),
    serviceWorkers: "block",
  });

  try {
    await context.route(
      (url) =>
        url.hostname === "spycat.horus.dev" ||
        url.pathname === "/api/spycat" ||
        url.pathname.startsWith("/api/spycat/"),
      (route) => route.abort(),
    );

    return context;
  } catch (error) {
    await context.close();
    throw error;
  }
}
