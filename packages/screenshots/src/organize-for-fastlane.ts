/**
 * Organizes screenshots from the screenshots package into fastlane's expected format.
 *
 * Input structure (from screenshots package):
 *   screenshots/{locale}/{device}/{name}.{suffix}.png
 *
 * Output structure (for fastlane):
 *   {output_dir}/{app_store_locale}/{device_frame}-{index}_{name}.png
 *
 * Usage:
 *   npx tsx scripts/organize-for-fastlane.ts --output ../mobile/ios/App/fastlane/screenshots
 */

import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const SCREENSHOTS_DIR = path.resolve(ROOT_DIR, "screenshots");

// Map from our locale codes to App Store Connect locale codes
const LOCALE_MAPPING: Record<string, string[]> = {
  en: ["en-US", "en-GB", "en-AU", "en-CA"],
  es: ["es-ES", "es-MX"],
};

// Map from our device folders to App Store Connect device frame names
// See: https://docs.fastlane.tools/actions/deliver/#available-screenshot-types
const DEVICE_FRAME_MAPPING: Record<string, string | null> = {
  // iPhone 14 Plus = 6.7" display (1284 x 2778)
  "iphone-6.7": 'iPhone 6.7" Display',
  // iPhone 11 Pro Max = 6.5" display (1242 x 2688)
  "iphone-6.5": 'iPhone 6.5" Display',
  // Legacy folder name (backwards compatibility)
  iphone: 'iPhone 6.7" Display',
  // iPad Pro 11" = 11" display (1668 x 2388)
  "ipad-pro": 'iPad Pro 11" Display',
  // Legacy folder name (backwards compatibility)
  tablet: 'iPad Pro 11" Display',
  // Skip android and desktop for iOS fastlane
  android: null,
  desktop: null,
};

// Order of screenshots (determines the index in filename)
const SCREENSHOT_ORDER = [
  "balances",
  "expense-log",
  "expense-details",
  "expense-editor",
];

interface Options {
  output: string;
  clean: boolean;
}

function parseOptions(): Options {
  const { values } = parseArgs({
    options: {
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
    console.error("Usage: pnpm organize:fastlane --output <path>");
    process.exit(1);
  }

  return {
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

async function organizeScreenshots(options: Options): Promise<void> {
  const outputDir = path.resolve(options.output);

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

  for (const locale of locales) {
    const appStoreLocales = LOCALE_MAPPING[locale];
    if (!appStoreLocales) {
      console.warn(`Warning: Unknown locale "${locale}", skipping`);
      continue;
    }

    // Get all devices for this locale
    const localeDir = path.join(SCREENSHOTS_DIR, locale);
    const devices = await readdir(localeDir);

    for (const device of devices) {
      const deviceFrame = DEVICE_FRAME_MAPPING[device];
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

  console.log("\nDone!");
}

const options = parseOptions();
void organizeScreenshots(options);
