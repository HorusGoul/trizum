import type { Browser } from "playwright";
import { chromium, devices } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { migrationData } from "./data/migration-data.ts";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const SCREENSHOTS_OUTPUT_DIR = path.resolve(ROOT_DIR, "screenshots");

type DeviceDescriptor = (typeof devices)[keyof typeof devices];

interface SelectedDevice {
  device: DeviceDescriptor;
  folder: string;
  suffix?: string;
}

// Custom device configurations for exact App Store screenshot sizes
// Based on: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
//
// App Store requires specific pixel dimensions, so we set viewport sizes
// that when multiplied by deviceScaleFactor give exact required dimensions

const selectedDevices: SelectedDevice[] = [
  // Android (Pixel 7 for Play Store)
  {
    device: devices["Pixel 7"],
    folder: "android",
    suffix: "portrait",
  },
  // iPhone 6.5" Display: 1284×2778 pixels
  // Required if app runs on iPhone (and 6.9" screenshots aren't provided)
  // Accepted sizes: 1284×2778 or 1242×2688
  // viewport 428×926 × deviceScaleFactor 3 = 1284×2778
  {
    device: {
      ...devices["iPhone 14 Plus"],
      viewport: { width: 428, height: 926 },
      deviceScaleFactor: 3,
    },
    folder: "iphone-6.5",
    suffix: "portrait",
  },
  // iPad 13" Display: 2048×2732 pixels
  // Required if app runs on iPad
  // Accepted sizes: 2064×2752 or 2048×2732
  // viewport 1024×1366 × deviceScaleFactor 2 = 2048×2732
  {
    device: {
      ...devices["iPad Pro 11"],
      viewport: { width: 1024, height: 1366 },
      deviceScaleFactor: 2,
    },
    folder: "ipad-13",
    suffix: "portrait",
  },
  // Desktop (for web/marketing)
  {
    device: {
      ...devices["Desktop Chrome"],
      viewport: {
        width: 1920,
        height: 1080,
      },
    },
    folder: "desktop",
    suffix: "landscape",
  },
];

const languages = ["en", "es"];

async function main() {
  let browser: Browser | null = null;

  try {
    console.log("Starting browser");
    browser = await chromium.launch({ headless: true });

    for (const language of languages) {
      for (const selectedDevice of selectedDevices) {
        const screenshotsFolder = path.resolve(
          SCREENSHOTS_OUTPUT_DIR,
          language,
          selectedDevice.folder,
        );

        console.log(
          `Taking screenshots for ${language} on ${selectedDevice.folder} saved to ${screenshotsFolder}`,
        );

        await mkdir(screenshotsFolder, { recursive: true });

        const context = await browser.newContext({
          ...selectedDevice.device,
          locale: language,
          baseURL: "https://trizum.app/?__internal_offline_only=true",
        });

        console.log("Importing screenshots module");

        await import("./screenshots/all-screenshots.ts");

        for (const screenshotFn of global.__screenshots.values()) {
          const page = await context.newPage();

          async function takeScreenshot(name: string) {
            await page.evaluate(() => {
              // Insert this style to hide toasts before taking a screenshot
              const style = document.createElement("style");
              style.textContent = `
                [aria-label="Notifications alt+T"] {
                  display: none !important;
                }
              `;
              document.head.appendChild(style);
            });

            await page.screenshot({
              path: path.resolve(
                screenshotsFolder,
                [name, selectedDevice.suffix, "png"].filter(Boolean).join("."),
              ),
            });
          }

          async function setupParty() {
            await page.goto("/");
            await page
              .getByText("trizum", {
                exact: true,
              })
              .waitFor({
                state: "visible",
              });
            const partyId = await page.evaluate(async (data) => {
              // @ts-expect-error - Internal function
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call
              return (await window.__internal_createPartyFromMigrationData(
                data,
              )) as string;
            }, migrationData);

            await page.goto(`/party/${partyId}/who`);
            await page
              .getByRole("radio", { name: "Modest" })
              .click({ force: true });
            await page.getByRole("button", { name: /save|guardar/i }).click();

            // Wait for Balances text to show up
            await page
              .locator("[role='tab']", {
                hasText: /balances|balance/i,
              })
              .waitFor({
                state: "visible",
              });
          }

          try {
            await screenshotFn({ page, takeScreenshot, setupParty });
          } catch (error) {
            console.error(error);
            throw error;
          } finally {
            await page.close();
          }

          await page.close();
        }

        await context.close();
      }
    }
  } catch (error) {
    console.error(error);
  } finally {
    await browser?.close();
  }
}

void main();
