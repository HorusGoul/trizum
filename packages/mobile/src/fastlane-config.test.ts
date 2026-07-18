import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vite-plus/test";

const fastfileUrl = new URL("../ios/App/fastlane/Fastfile", import.meta.url);

describe("iOS Fastlane screenshot uploads", () => {
  test("synchronizes every screenshot upload with a bounded processing time", async () => {
    const fastfile = await readFile(fastfileUrl, "utf8");

    expect(fastfile.match(/sync_screenshots: true/g)).toHaveLength(1);
    expect(fastfile).toContain("sync_screenshots: !skip_screenshots");
    expect(fastfile).toContain('ENV["FASTLANE_ENABLE_BETA_DELIVER_SYNC_SCREENSHOTS"] = "true"');
    expect(fastfile).toContain(
      "Timeout.timeout(IOS_SCREENSHOT_PROCESSING_TIMEOUT_SECONDS) { super }",
    );
    expect(fastfile).toContain("Deliver::SyncScreenshots.prepend(BoundedScreenshotSync)");
    expect(fastfile).not.toContain("overwrite_screenshots:");
  });
});
