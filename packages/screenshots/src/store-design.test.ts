import { describe, expect, it } from "vite-plus/test";
import { getMigrationData } from "./data/migration-data.ts";
import { STORE_DEVICE_OUTPUTS, STORE_SCENES, STORE_SCREENSHOT_ORDER } from "./store-design.ts";

describe("store screenshot design", () => {
  it("defines exactly one localized scene for every ordered screenshot", () => {
    expect(STORE_SCENES.map(({ name }) => name)).toEqual(STORE_SCREENSHOT_ORDER);
    expect(new Set(STORE_SCREENSHOT_ORDER).size).toBe(STORE_SCREENSHOT_ORDER.length);

    for (const scene of STORE_SCENES) {
      for (const locale of ["en", "es"] as const) {
        expect(scene.copy[locale].eyebrow).not.toHaveLength(0);
        expect(scene.copy[locale].title).not.toHaveLength(0);
        expect(scene.copy[locale].subtitle).not.toHaveLength(0);
      }
    }
  });

  it("localizes seeded content without mutating the English fixture", () => {
    const english = getMigrationData("en");
    const spanish = getMigrationData("es");

    expect(english.party.name).toBe("Andalusian Point");
    expect(spanish.party.name).toBe("Ruta por Andalucía");
    expect(english.expenses.find(({ name }) => name === "Breakfast churros")).toBeDefined();
    expect(spanish.expenses.find(({ name }) => name === "Churros para desayunar")).toBeDefined();
  });

  it("uses upload-ready App Store and Google Play dimensions", () => {
    expect(STORE_DEVICE_OUTPUTS).toEqual({
      android: { width: 1080, height: 1920, platform: "google-play", suffix: "portrait" },
      "android-tablet": {
        width: 2560,
        height: 1600,
        platform: "google-play",
        suffix: "landscape",
      },
      "iphone-6.9": {
        width: 1320,
        height: 2868,
        platform: "app-store",
        suffix: "portrait",
      },
      "ipad-13": {
        width: 2064,
        height: 2752,
        platform: "app-store",
        suffix: "portrait",
      },
    });
  });
});
