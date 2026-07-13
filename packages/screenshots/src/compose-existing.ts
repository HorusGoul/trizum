import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { generateFeatureGraphics } from "./feature-graphic.ts";
import {
  composeStoreScreenshot,
  STORE_DEVICE_OUTPUTS,
  STORE_SCENES,
  type StoreLocale,
} from "./store-design.ts";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const RAW_SCREENSHOTS_DIR = path.resolve(ROOT_DIR, ".captures");
const SCREENSHOTS_DIR = path.resolve(ROOT_DIR, "screenshots");
const locales = ["en", "es"] as const satisfies readonly StoreLocale[];

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    try {
      for (const locale of locales) {
        for (const [device, output] of Object.entries(STORE_DEVICE_OUTPUTS)) {
          const outputDirectory = path.resolve(SCREENSHOTS_DIR, locale, device);
          await mkdir(outputDirectory, { recursive: true });

          for (const scene of STORE_SCENES) {
            const filename = `${scene.name}.${output.suffix}.png`;
            await composeStoreScreenshot({
              ...output,
              locale,
              outputPath: path.resolve(outputDirectory, filename),
              page,
              rawScreenshotPath: path.resolve(RAW_SCREENSHOTS_DIR, locale, device, filename),
              scene,
            });
          }
        }
      }
    } finally {
      await page.close();
    }

    await generateFeatureGraphics(browser, locales);
  } finally {
    await browser.close();
  }
}

void main();
