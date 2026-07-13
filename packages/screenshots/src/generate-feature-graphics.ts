import { chromium } from "playwright";
import { generateFeatureGraphics } from "./feature-graphic.ts";
import type { StoreLocale } from "./store-design.ts";

const locales = ["en", "es"] as const satisfies readonly StoreLocale[];

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });

  try {
    await generateFeatureGraphics(browser, locales);
  } finally {
    await browser.close();
  }
}

void main();
