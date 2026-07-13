import { describe, expect, it } from "vite-plus/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getMigrationData } from "./data/migration-data.ts";
import { FEATURE_GRAPHIC_COPY, PLAY_FEATURE_GRAPHIC } from "./feature-graphic.ts";
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
    expect(PLAY_FEATURE_GRAPHIC).toEqual({ width: 1024, height: 500 });
  });

  it("keeps feature graphic copy localized and concise", () => {
    expect(Object.keys(FEATURE_GRAPHIC_COPY)).toEqual(["en", "es"]);

    for (const copy of Object.values(FEATURE_GRAPHIC_COPY)) {
      expect(copy.eyebrow.length).toBeLessThan(24);
      expect(copy.title.length).toBeLessThan(48);
    }
  });

  it("commits upload-ready feature graphics without an alpha channel", async () => {
    for (const locale of ["en", "es"] as const) {
      const png = await readFile(
        path.resolve(import.meta.dirname, "../feature-graphics", locale, "featureGraphic.png"),
      );

      expect(png.readUInt32BE(16)).toBe(PLAY_FEATURE_GRAPHIC.width);
      expect(png.readUInt32BE(20)).toBe(PLAY_FEATURE_GRAPHIC.height);
      expect(png[24]).toBe(8);
      expect(png[25]).toBe(2);
    }
  });
});
