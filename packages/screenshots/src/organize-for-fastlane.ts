/**
 * Organizes screenshots from the screenshots package into fastlane's expected format.
 *
 * Input structure (from screenshots package):
 *   screenshots/{locale}/{device}/{name}.{suffix}.png
 *
 * Output structure for iOS (for fastlane deliver):
 *   {output_dir}/{app_store_locale}/{device_frame}-{index}_{name}.png
 *
 * Output structure for Android (for fastlane supply):
 *   {output_dir}/{play_store_locale}/images/phoneScreenshots/{index}_{name}.png
 *
 * Usage:
 *   npx tsx scripts/organize-for-fastlane.ts --platform ios --output ../mobile/ios/App/fastlane/screenshots
 *   npx tsx scripts/organize-for-fastlane.ts --platform android --output ../mobile/android/fastlane/metadata/android
 */

import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const SCREENSHOTS_DIR = path.resolve(ROOT_DIR, "screenshots");

type Platform = "ios" | "android";

// Map from our locale codes to App Store Connect locale codes
const IOS_LOCALE_MAPPING: Record<string, string[]> = {
  en: ["en-US", "en-GB", "en-AU", "en-CA"],
  es: ["es-ES", "es-MX"],
};

// Map from our locale codes to Google Play Store locale codes
const ANDROID_LOCALE_MAPPING: Record<string, string[]> = {
  en: ["en-US"],
  es: ["es-ES"],
};

// Map from our device folders to App Store Connect device frame names
// Based on: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
// Fastlane uses human-readable names in screenshot filenames
const IOS_DEVICE_FRAME_MAPPING: Record<string, string | null> = {
  // iPhone 6.5" Display (1284×2778) - Required if app runs on iPhone
  "iphone-6.5": 'iPhone 6.5" Display',
  // iPad 13" Display (2064×2752) - Required if app runs on iPad
  "ipad-13": 'iPad 13" Display',
  // Skip android and desktop for iOS fastlane
  android: null,
  desktop: null,
};

// Map from our device folders to Android screenshot types
// Android uses specific folder names for different device types:
// - phoneScreenshots: Phone screenshots
// - sevenInchScreenshots: 7" tablet screenshots
// - tenInchScreenshots: 10" tablet screenshots
// - tvScreenshots: TV screenshots
// - wearScreenshots: Wear OS screenshots
const ANDROID_DEVICE_MAPPING: Record<string, string | null> = {
  android: "phoneScreenshots",
  desktop: "tenInchScreenshots", // Use desktop screenshots for 10" tablets
  // Skip iOS-specific devices
  "iphone-6.5": null,
  "ipad-13": null,
};

// Order of screenshots (determines the index in filename)
const SCREENSHOT_ORDER = [
  "balances",
  "expense-log",
  "expense-details",
  "expense-editor",
];

interface Options {
  platform: Platform;
  output: string;
  clean: boolean;
}

function parseOptions(): Options {
  const { values } = parseArgs({
    options: {
      platform: {
        type: "string",
        short: "p",
        default: "ios",
      },
      output: {
        type: "string",
        short: "o",
      },
      clean: {
        type: "boolean",
        default: true,
      },
    },
  });

  if (!values.output) {
    console.error("Error: --output is required");
    console.error(
      "Usage: pnpm organize:fastlane --platform <ios|android> --output <path>",
    );
    process.exit(1);
  }

  const platform = values.platform as Platform;
  if (platform !== "ios" && platform !== "android") {
    console.error('Error: --platform must be either "ios" or "android"');
    process.exit(1);
  }

  return {
    platform,
    output: values.output,
    clean: values.clean ?? true,
  };
}

async function getScreenshotFiles(
  locale: string,
  device: string,
): Promise<string[]> {
  const deviceDir = path.join(SCREENSHOTS_DIR, locale, device);

  try {
    const files = await readdir(deviceDir);
    return files.filter((f) => f.endsWith(".png"));
  } catch {
    return [];
  }
}

function getScreenshotIndex(filename: string): number {
  // Extract the name from filename (e.g., "expense-log.portrait.png" -> "expense-log")
  const name = filename.split(".")[0];
  const index = SCREENSHOT_ORDER.indexOf(name);
  return index === -1 ? 999 : index;
}

async function organizeForIOS(
  outputDir: string,
  locales: string[],
): Promise<void> {
  for (const locale of locales) {
    const appStoreLocales = IOS_LOCALE_MAPPING[locale];
    if (!appStoreLocales) {
      console.warn(`Warning: Unknown locale "${locale}", skipping`);
      continue;
    }

    // Get all devices for this locale
    const localeDir = path.join(SCREENSHOTS_DIR, locale);
    const devices = await readdir(localeDir);

    for (const device of devices) {
      const deviceFrame = IOS_DEVICE_FRAME_MAPPING[device];
      if (deviceFrame === null) {
        console.log(`Skipping ${locale}/${device} (not for iOS)`);
        continue;
      }
      if (deviceFrame === undefined) {
        console.warn(`Warning: Unknown device "${device}", skipping`);
        continue;
      }

      const files = await getScreenshotFiles(locale, device);
      if (files.length === 0) {
        console.warn(`Warning: No screenshots found for ${locale}/${device}`);
        continue;
      }

      // Sort files by screenshot order
      files.sort((a, b) => getScreenshotIndex(a) - getScreenshotIndex(b));

      // Copy files to each App Store locale
      for (const appStoreLocale of appStoreLocales) {
        const localeOutputDir = path.join(outputDir, appStoreLocale);
        await mkdir(localeOutputDir, { recursive: true });

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const name = file.split(".")[0]; // "expense-log.portrait.png" -> "expense-log"
          const index = i + 1; // 1-based index

          // Format: "iPhone 6.7" Display-1_expense-log.png"
          const outputFilename = `${deviceFrame}-${index}_${name}.png`;
          const inputPath = path.join(SCREENSHOTS_DIR, locale, device, file);
          const outputPath = path.join(localeOutputDir, outputFilename);

          await copyFile(inputPath, outputPath);
          console.log(
            `  ${locale}/${device}/${file} -> ${appStoreLocale}/${outputFilename}`,
          );
        }
      }
    }
  }
}

async function organizeForAndroid(
  outputDir: string,
  locales: string[],
): Promise<void> {
  for (const locale of locales) {
    const playStoreLocales = ANDROID_LOCALE_MAPPING[locale];
    if (!playStoreLocales) {
      console.warn(`Warning: Unknown locale "${locale}", skipping`);
      continue;
    }

    // Get all devices for this locale
    const localeDir = path.join(SCREENSHOTS_DIR, locale);
    const devices = await readdir(localeDir);

    for (const device of devices) {
      const screenshotType = ANDROID_DEVICE_MAPPING[device];
      if (screenshotType === null) {
        console.log(`Skipping ${locale}/${device} (not for Android)`);
        continue;
      }
      if (screenshotType === undefined) {
        console.warn(`Warning: Unknown device "${device}", skipping`);
        continue;
      }

      const files = await getScreenshotFiles(locale, device);
      if (files.length === 0) {
        console.warn(`Warning: No screenshots found for ${locale}/${device}`);
        continue;
      }

      // Sort files by screenshot order
      files.sort((a, b) => getScreenshotIndex(a) - getScreenshotIndex(b));

      // Copy files to each Play Store locale
      for (const playStoreLocale of playStoreLocales) {
        // Android structure: {locale}/images/{screenshotType}/
        const screenshotsOutputDir = path.join(
          outputDir,
          playStoreLocale,
          "images",
          screenshotType,
        );
        await mkdir(screenshotsOutputDir, { recursive: true });

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const name = file.split(".")[0]; // "expense-log.portrait.png" -> "expense-log"
          const index = i + 1; // 1-based index

          // Android format: "1_expense-log.png" (simple numbering)
          const outputFilename = `${index}_${name}.png`;
          const inputPath = path.join(SCREENSHOTS_DIR, locale, device, file);
          const outputPath = path.join(screenshotsOutputDir, outputFilename);

          await copyFile(inputPath, outputPath);
          console.log(
            `  ${locale}/${device}/${file} -> ${playStoreLocale}/images/${screenshotType}/${outputFilename}`,
          );
        }
      }
    }
  }
}

async function organizeScreenshots(options: Options): Promise<void> {
  const outputDir = path.resolve(options.output);

  console.log(`Platform: ${options.platform}`);
  console.log(`Input directory: ${SCREENSHOTS_DIR}`);
  console.log(`Output directory: ${outputDir}`);

  // Clean output directory if requested
  if (options.clean) {
    console.log("Cleaning output directory...");
    try {
      await rm(outputDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  }

  // Get all locales
  const locales = await readdir(SCREENSHOTS_DIR);

  if (options.platform === "ios") {
    await organizeForIOS(outputDir, locales);
  } else {
    await organizeForAndroid(outputDir, locales);
  }

  console.log("\nDone!");
}

const options = parseOptions();
void organizeScreenshots(options);
