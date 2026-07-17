import { mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { organizeScreenshots } from "./organize-for-fastlane.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "trizum-screenshots-"));
  temporaryDirectories.push(directory);
  return directory;
}

describe("organizeScreenshots", () => {
  test("produces the same clean and ordered iOS set when rerun", async () => {
    const rootDirectory = await createTemporaryDirectory();
    const screenshotsDirectory = path.join(rootDirectory, "input");
    const deviceDirectory = path.join(screenshotsDirectory, "en", "iphone-6.9");
    const outputDirectory = path.join(rootDirectory, "output");
    await mkdir(deviceDirectory, { recursive: true });
    await mkdir(path.join(outputDirectory, "en-US"), { recursive: true });

    const inputFilenames = [
      "expense-editor.portrait.png",
      "legacy.portrait.png",
      "expense-details.portrait.png",
      "balances.portrait.png",
      "expense-log.portrait.png",
      "group-members.portrait.png",
      "stats.portrait.png",
    ];

    await Promise.all(
      inputFilenames.map((filename) => writeFile(path.join(deviceDirectory, filename), filename)),
    );
    await writeFile(path.join(outputDirectory, "en-US", "stale.png"), "stale");

    const options = {
      clean: true,
      output: outputDirectory,
      platform: "ios" as const,
      screenshotsDirectory,
    };

    await organizeScreenshots(options);
    await unlink(path.join(deviceDirectory, "legacy.portrait.png"));
    await organizeScreenshots(options);

    const outputFilenames = await readdir(path.join(outputDirectory, "en-US"));

    expect(outputFilenames.sort()).toEqual([
      'iPhone 6.9" Display-1_expense-log.png',
      'iPhone 6.9" Display-2_balances.png',
      'iPhone 6.9" Display-3_expense-editor.png',
      'iPhone 6.9" Display-4_expense-details.png',
      'iPhone 6.9" Display-5_stats.png',
      'iPhone 6.9" Display-6_group-members.png',
    ]);
  });

  test("places Android screenshots and feature graphics in Supply directories", async () => {
    const rootDirectory = await createTemporaryDirectory();
    const screenshotsDirectory = path.join(rootDirectory, "input");
    const featureGraphicsDirectory = path.join(rootDirectory, "feature-graphics");
    const phoneDirectory = path.join(screenshotsDirectory, "es", "android");
    const tabletDirectory = path.join(screenshotsDirectory, "es", "android-tablet");
    const outputDirectory = path.join(rootDirectory, "output");
    const imagesDirectory = path.join(outputDirectory, "es-ES", "images");

    await Promise.all([
      mkdir(phoneDirectory, { recursive: true }),
      mkdir(tabletDirectory, { recursive: true }),
      mkdir(path.join(featureGraphicsDirectory, "es"), { recursive: true }),
      mkdir(path.join(imagesDirectory, "phoneScreenshots"), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(path.join(phoneDirectory, "balances.portrait.png"), "balances"),
      writeFile(path.join(phoneDirectory, "expense-log.portrait.png"), "expense-log"),
      writeFile(path.join(tabletDirectory, "expense-log.landscape.png"), "tablet"),
      writeFile(path.join(featureGraphicsDirectory, "es", "featureGraphic.png"), "feature"),
      writeFile(path.join(imagesDirectory, "icon.png"), "existing icon"),
      writeFile(path.join(imagesDirectory, "phoneScreenshots", "stale.png"), "stale"),
    ]);

    await organizeScreenshots({
      clean: true,
      featureGraphicsDirectory,
      output: outputDirectory,
      platform: "android",
      screenshotsDirectory,
    });

    await expect(readFile(path.join(imagesDirectory, "featureGraphic.png"), "utf8")).resolves.toBe(
      "feature",
    );
    await expect(readFile(path.join(imagesDirectory, "icon.png"), "utf8")).resolves.toBe(
      "existing icon",
    );
    expect((await readdir(path.join(imagesDirectory, "phoneScreenshots"))).sort()).toEqual([
      "1_expense-log.png",
      "2_balances.png",
    ]);
    expect((await readdir(path.join(imagesDirectory, "sevenInchScreenshots"))).sort()).toEqual([
      "1_expense-log.png",
    ]);
    expect((await readdir(path.join(imagesDirectory, "tenInchScreenshots"))).sort()).toEqual([
      "1_expense-log.png",
    ]);
  });
});
