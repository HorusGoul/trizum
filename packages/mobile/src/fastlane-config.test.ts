import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vite-plus/test";

const fastfileUrl = new URL("../ios/App/fastlane/Fastfile", import.meta.url);

describe("iOS Fastlane screenshot uploads", () => {
  test("synchronizes the local screenshot set on every uploading lane", async () => {
    const fastfile = await readFile(fastfileUrl, "utf8");

    expect(fastfile.match(/sync_screenshots: true/g)).toHaveLength(1);
    expect(fastfile).toContain("sync_screenshots: !skip_screenshots");
    expect(fastfile).toContain('ENV["FASTLANE_ENABLE_BETA_DELIVER_SYNC_SCREENSHOTS"] = "true"');
    expect(fastfile).not.toContain("overwrite_screenshots:");
  });
});
