import { describe, expect, test } from "vite-plus/test";
import { getStorePreviewScreenshotFilename, STORE_PREVIEW_SETS } from "./generate-previews.ts";

describe("store preview sets", () => {
  test("covers every generated store device in every locale", () => {
    expect(STORE_PREVIEW_SETS.map(({ device, locale }) => `${locale}/${device}`).sort()).toEqual([
      "en/android",
      "en/android-tablet",
      "en/ipad-13",
      "en/iphone-6.9",
      "es/android",
      "es/android-tablet",
      "es/ipad-13",
      "es/iphone-6.9",
    ]);
  });

  test("labels the shared Play tablet artwork for both tablet slots", () => {
    const tabletPreviews = STORE_PREVIEW_SETS.filter(({ device }) => device === "android-tablet");

    expect(tabletPreviews).toHaveLength(2);
    expect(tabletPreviews.every(({ slot }) => slot.includes("7″ and 10″ slots"))).toBe(true);
  });

  test("uses each device's generated screenshot orientation", () => {
    expect(getStorePreviewScreenshotFilename("android", "expense-log")).toBe(
      "expense-log.portrait.png",
    );
    expect(getStorePreviewScreenshotFilename("android-tablet", "expense-log")).toBe(
      "expense-log.landscape.png",
    );
  });
});
