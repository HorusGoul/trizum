import { mkdir, mkdtemp, readdir, rm, unlink, writeFile } from "node:fs/promises";
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

describe("organizeScreenshots", () => {
  test("produces the same clean and ordered iOS set when rerun", async () => {
    const rootDirectory = await mkdtemp(path.join(os.tmpdir(), "trizum-screenshots-"));
    temporaryDirectories.push(rootDirectory);

    const screenshotsDirectory = path.join(rootDirectory, "input");
    const deviceDirectory = path.join(screenshotsDirectory, "en", "iphone-6.5");
    const outputDirectory = path.join(rootDirectory, "output");
    await mkdir(deviceDirectory, { recursive: true });
    await mkdir(path.join(outputDirectory, "en-US"), { recursive: true });

    const inputFilenames = [
      "expense-editor.portrait.png",
      "legacy.portrait.png",
      "expense-details.portrait.png",
      "balances.portrait.png",
      "expense-log.portrait.png",
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
      'iPhone 6.5" Display-1_balances.png',
      'iPhone 6.5" Display-2_expense-log.png',
      'iPhone 6.5" Display-3_expense-details.png',
      'iPhone 6.5" Display-4_expense-editor.png',
    ]);
  });
});
