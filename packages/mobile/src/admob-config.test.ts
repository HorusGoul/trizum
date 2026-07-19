import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vite-plus/test";

const packageRoot = new URL("../", import.meta.url);
const workspaceRoot = new URL("../../", packageRoot);

interface AdMobPlatformConfig {
  appId: string;
  appOpen: string;
  interstitial: string;
}

interface AdMobConfig {
  test: { android: AdMobPlatformConfig; ios: AdMobPlatformConfig };
  live: { android: AdMobPlatformConfig; ios: AdMobPlatformConfig };
}

describe("AdMob release configuration", () => {
  test("contains distinct public test and live IDs for both platforms", async () => {
    const config = JSON.parse(
      await readFile(new URL("admob.config.json", packageRoot), "utf8"),
    ) as AdMobConfig;
    const ids = new Set<string>();

    for (const environment of [config.test, config.live]) {
      for (const platform of [environment.android, environment.ios]) {
        expect(platform.appId).toMatch(/^ca-app-pub-\d+~\d+$/);
        expect(platform.appOpen).toMatch(/^ca-app-pub-\d+\/\d+$/);
        expect(platform.interstitial).toMatch(/^ca-app-pub-\d+\/\d+$/);
        ids.add(platform.appId);
        ids.add(platform.appOpen);
        ids.add(platform.interstitial);
      }
    }

    expect(ids.size).toBe(12);
  });

  test("selects live IDs only in official production artifact workflows", async () => {
    const [mobileBuild, release, androidStore, iosStore] = await Promise.all([
      readWorkflow("mobile-build.yml"),
      readWorkflow("release.yml"),
      readWorkflow("android-playstore-deploy.yml"),
      readWorkflow("ios-appstore-deploy.yml"),
    ]);

    expect(mobileBuild).toContain("default: false");
    expect(mobileBuild).toContain("TRIZUM_LIVE_ADS: ${{ inputs.live_ads");
    expect(release).toContain("live_ads: true");
    expect(androidStore).toContain("inputs.track == 'production'");
    expect(iosStore).toContain('TRIZUM_LIVE_ADS: "true"');
  });
});

function readWorkflow(name: string) {
  return readFile(new URL(`.github/workflows/${name}`, workspaceRoot), "utf8");
}
