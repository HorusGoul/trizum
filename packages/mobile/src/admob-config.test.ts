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
  test("pairs trizum app IDs with distinct test and live ad units", async () => {
    const config = JSON.parse(
      await readFile(new URL("admob.config.json", packageRoot), "utf8"),
    ) as AdMobConfig;
    const adUnitIds = new Set<string>();

    for (const environment of [config.test, config.live]) {
      for (const platform of [environment.android, environment.ios]) {
        expect(platform.appId).toMatch(/^ca-app-pub-\d+~\d+$/);
        expect(platform.appOpen).toMatch(/^ca-app-pub-\d+\/\d+$/);
        expect(platform.interstitial).toMatch(/^ca-app-pub-\d+\/\d+$/);
        adUnitIds.add(platform.appOpen);
        adUnitIds.add(platform.interstitial);
      }
    }

    expect(config.test.android.appId).toBe(config.live.android.appId);
    expect(config.test.ios.appId).toBe(config.live.ios.appId);
    expect(config.test.android.appId).toContain("ca-app-pub-8039329288910865~");
    expect(config.test.ios.appId).toContain("ca-app-pub-8039329288910865~");
    expect(config.test.android.appOpen).toContain("ca-app-pub-3940256099942544/");
    expect(config.test.android.interstitial).toContain("ca-app-pub-3940256099942544/");
    expect(config.test.ios.appOpen).toContain("ca-app-pub-3940256099942544/");
    expect(config.test.ios.interstitial).toContain("ca-app-pub-3940256099942544/");
    expect(adUnitIds.size).toBe(8);
  });

  test("selects live ad units only in production and registered-device review workflows", async () => {
    const [mobileBuild, release, androidStore, iosStore, androidReview, iosReview] =
      await Promise.all([
        readWorkflow("mobile-build.yml"),
        readWorkflow("release.yml"),
        readWorkflow("android-playstore-deploy.yml"),
        readWorkflow("ios-appstore-deploy.yml"),
        readWorkflow("android-internal-testing.yml"),
        readWorkflow("ios-testflight.yml"),
      ]);

    expect(mobileBuild).toContain("default: false");
    expect(mobileBuild).toContain("TRIZUM_LIVE_ADS: ${{ inputs.live_ads");
    expect(release).toContain("live_ads: true");
    expect(androidStore).toContain("inputs.track == 'production'");
    expect(iosStore).toContain('TRIZUM_LIVE_ADS: "true"');
    expect(androidReview).toContain('TRIZUM_LIVE_ADS: "true"');
    expect(iosReview).toContain('TRIZUM_LIVE_ADS: "true"');
  });
});

function readWorkflow(name: string) {
  return readFile(new URL(`.github/workflows/${name}`, workspaceRoot), "utf8");
}
