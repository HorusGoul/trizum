import type { Browser } from "playwright";
import { chromium, devices } from "playwright";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { getMigrationData } from "./data/migration-data.ts";
import { generateFeatureGraphics } from "./feature-graphic.ts";
import { configureScreenshotsLogging, getLogger } from "./log.ts";
import {
  composeStoreScreenshot,
  STORE_DEVICE_OUTPUTS,
  STORE_SCENES,
  type StoreLocale,
  type StorePlatform,
} from "./store-design.ts";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const SCREENSHOTS_OUTPUT_DIR = path.resolve(ROOT_DIR, "screenshots");
const RAW_SCREENSHOTS_OUTPUT_DIR = path.resolve(ROOT_DIR, ".captures");
const BASE_URL = process.env.SCREENSHOTS_BASE_URL ?? "https://trizum.app";
const APP_ENTRY_PATH = "/?__internal_offline_only=true";
const FIXED_TIME = new Date("2025-03-12T12:00:00.000Z");

configureScreenshotsLogging();

const logger = getLogger("capture");

type DeviceDescriptor = (typeof devices)[keyof typeof devices];

interface SelectedDevice {
  device: DeviceDescriptor;
  folder: string;
  output: {
    height: number;
    platform: StorePlatform;
    width: number;
  };
  suffix?: string;
}

// Custom device configurations for exact App Store screenshot sizes
// Based on: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
//
// App Store requires specific pixel dimensions, so we set viewport sizes
// that when multiplied by deviceScaleFactor give exact required dimensions

const allDevices: SelectedDevice[] = [
  // Android (Pixel 7 for Play Store)
  {
    device: {
      ...devices["Pixel 7"],
      viewport: { width: 360, height: 640 },
      deviceScaleFactor: 3,
    },
    folder: "android",
    output: STORE_DEVICE_OUTPUTS.android,
    suffix: "portrait",
  },
  // iPhone 6.9" Display: 1320×2868 pixels
  {
    device: {
      ...devices["iPhone 14 Plus"],
      viewport: { width: 440, height: 956 },
      deviceScaleFactor: 3,
    },
    folder: "iphone-6.9",
    output: STORE_DEVICE_OUTPUTS["iphone-6.9"],
    suffix: "portrait",
  },
  // iPad 13" Display: 2064×2752 pixels
  // Required if app runs on iPad
  // viewport 1032×1376 × deviceScaleFactor 2 = 2064×2752
  {
    device: {
      ...devices["iPad Pro 11"],
      viewport: { width: 1032, height: 1376 },
      deviceScaleFactor: 2,
    },
    folder: "ipad-13",
    output: STORE_DEVICE_OUTPUTS["ipad-13"],
    suffix: "portrait",
  },
  // Google Play tablet feature screenshots use the recommended 8:5 ratio.
  {
    device: {
      ...devices["Desktop Chrome"],
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
    },
    folder: "android-tablet",
    output: STORE_DEVICE_OUTPUTS["android-tablet"],
    suffix: "landscape",
  },
];

const allLanguages = ["en", "es"] as const satisfies readonly StoreLocale[];

function requestedValues(environmentValue: string | undefined): Set<string> | null {
  const values = environmentValue
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return values && values.length > 0 ? new Set(values) : null;
}

const requestedDevices = requestedValues(process.env.SCREENSHOTS_DEVICES);
const requestedLanguages = requestedValues(process.env.SCREENSHOTS_LOCALES);
const requestedScenes = requestedValues(process.env.SCREENSHOTS_SCENES);
const selectedDevices = requestedDevices
  ? allDevices.filter(({ folder }) => requestedDevices.has(folder))
  : allDevices;
const languages = requestedLanguages
  ? allLanguages.filter((language) => requestedLanguages.has(language))
  : allLanguages;

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

async function main() {
  let browser: Browser | null = null;

  try {
    logger.info("Starting browser");
    browser = await chromium.launch({ headless: true });
    if (process.env.SCREENSHOTS_CLEAN !== "false") {
      await Promise.all([
        rm(SCREENSHOTS_OUTPUT_DIR, { force: true, recursive: true }),
        rm(RAW_SCREENSHOTS_OUTPUT_DIR, { force: true, recursive: true }),
      ]);
    }

    for (const language of languages) {
      for (const selectedDevice of selectedDevices) {
        const screenshotsFolder = path.resolve(
          SCREENSHOTS_OUTPUT_DIR,
          language,
          selectedDevice.folder,
        );
        const rawScreenshotsFolder = path.resolve(
          RAW_SCREENSHOTS_OUTPUT_DIR,
          language,
          selectedDevice.folder,
        );

        logger.info("Taking screenshots for {language} on {device}", {
          language,
          device: selectedDevice.folder,
          screenshotsFolder,
        });

        await Promise.all([
          mkdir(screenshotsFolder, { recursive: true }),
          mkdir(rawScreenshotsFolder, { recursive: true }),
        ]);

        logger.info("Importing screenshots module");

        await import("./screenshots/all-screenshots.ts");

        for (const [screenshotName, screenshotFn] of global.__screenshots) {
          if (requestedScenes && !requestedScenes.has(screenshotName)) {
            continue;
          }

          logger.info("Running screenshot {screenshotName}", {
            screenshotName,
            language,
            device: selectedDevice.folder,
          });

          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              const context = await browser.newContext({
                ...selectedDevice.device,
                locale: language === "en" ? "en-US" : "es-ES",
                timezoneId: "UTC",
                colorScheme: "dark",
                reducedMotion: "reduce",
                baseURL: BASE_URL,
              });
              context.setDefaultTimeout(15_000);

              try {
                const page = await context.newPage();
                await page.clock.install({ time: FIXED_TIME });
                const screenshotTarget = `${language}/${selectedDevice.folder}/${screenshotName}`;

                async function takeScreenshot(name: string) {
                  await page.evaluate(() => {
                    // Insert this style to hide toasts before taking a screenshot
                    const style = document.createElement("style");
                    style.textContent = `
                  [aria-label="Notifications alt+T"] {
                    display: none !important;
                  }
                  *, *::before, *::after {
                    animation-delay: 0s !important;
                    animation-duration: 0s !important;
                    caret-color: transparent !important;
                    transition-delay: 0s !important;
                    transition-duration: 0s !important;
                  }
                `;
                    document.head.appendChild(style);
                  });

                  await page.evaluate(async () => {
                    for (const animation of document.getAnimations()) {
                      const timing = animation.effect?.getComputedTiming();
                      if (Number.isFinite(timing?.endTime)) {
                        animation.finish();
                      }
                    }

                    await new Promise<void>((resolve) => {
                      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
                    });
                    await document.fonts.ready;
                  });
                  const rawScreenshotPath = path.resolve(
                    rawScreenshotsFolder,
                    [name, selectedDevice.suffix, "png"].filter(Boolean).join("."),
                  );
                  await page.screenshot({
                    animations: "disabled",
                    path: rawScreenshotPath,
                  });

                  const scene = STORE_SCENES.find((candidate) => candidate.name === name);
                  if (!scene) {
                    throw new Error(`Missing store design for screenshot ${name}`);
                  }

                  await composeStoreScreenshot({
                    ...selectedDevice.output,
                    locale: language,
                    outputPath: path.resolve(
                      screenshotsFolder,
                      [name, selectedDevice.suffix, "png"].filter(Boolean).join("."),
                    ),
                    page,
                    rawScreenshotPath,
                    scene,
                  });
                }

                async function setupParty() {
                  try {
                    await page.goto(APP_ENTRY_PATH);
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
                      return (await window.__internal_createPartyFromMigrationData(data)) as string;
                    }, getMigrationData(language));

                    await page.goto(`/party/${partyId}/who`);
                    await page.getByRole("radio", { name: "Modest" }).click({ force: true });
                    await page.getByRole("button", { name: /save|guardar/i }).click();

                    // Wait for Balances text to show up
                    await page
                      .locator("[role='tab']", {
                        hasText: /balances|balance/i,
                      })
                      .waitFor({
                        state: "visible",
                      });
                  } catch (error) {
                    throw new Error(
                      `Failed to seed screenshot party for ${screenshotTarget}: ${toError(error).message}`,
                      { cause: toError(error) },
                    );
                  }
                }

                try {
                  await screenshotFn({ page, takeScreenshot, setupParty });
                } catch (error) {
                  throw new Error(
                    `Failed to run screenshot ${screenshotTarget}: ${toError(error).message}`,
                    { cause: toError(error) },
                  );
                } finally {
                  await page.close();
                }
              } finally {
                await context.close();
              }

              break;
            } catch (error) {
              if (attempt === 3) {
                throw error;
              }

              logger.warning("Retrying screenshot after capture failure", {
                attempt,
                error: toError(error),
                screenshotName,
                language,
                device: selectedDevice.folder,
              });
            }
          }
        }
      }
    }

    const hasFeatureGraphicCaptures =
      selectedDevices.some(({ folder }) => folder === "android") &&
      (!requestedScenes ||
        (["expense-log", "balances"] as const).every((scene) => requestedScenes.has(scene)));

    if (hasFeatureGraphicCaptures) {
      await generateFeatureGraphics(browser, languages);
    }
  } finally {
    await browser?.close();
  }
}

void main().catch((error) => {
  const reportedError = toError(error);

  logger.error("Screenshot capture failed", { error: reportedError });
  process.stderr.write(`${reportedError.stack ?? reportedError.message}\n`);
  process.exitCode = 1;
});
