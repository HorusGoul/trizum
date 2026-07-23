import { describe, expect, it } from "vite-plus/test";
import { generateAndroidSplashIcon } from "./generate-android-splash-icon.js";

const logoSvg = `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="512" height="512" fill="black"/>
<path d="M10 10H20" stroke="white" stroke-width="4" stroke-linecap="round"/>
</svg>`;

describe("generateAndroidSplashIcon", () => {
  it("translates the logo path into a native Android vector drawable", () => {
    expect(generateAndroidSplashIcon(logoSvg)).toContain('android:pathData="M10 10H20"');
    expect(generateAndroidSplashIcon(logoSvg)).toContain('android:strokeWidth="4"');
    expect(generateAndroidSplashIcon(logoSvg)).toContain('android:width="288dp"');
  });

  it("rejects SVG features that cannot be translated losslessly", () => {
    const unsupportedSvg = logoSvg.replace("</svg>", '<circle cx="10" cy="10" r="2"/></svg>');

    expect(() => generateAndroidSplashIcon(unsupportedSvg)).toThrow(
      "Logo SVG must contain exactly one background rect followed by one path",
    );
  });

  it("rejects changes to the canonical logo colors", () => {
    expect(() =>
      generateAndroidSplashIcon(logoSvg.replace('stroke="white"', 'stroke="red"')),
    ).toThrow('path must have stroke="white"');
  });

  it("keeps the stroked mark inside Android's circular splash safe area", () => {
    const drawable = generateAndroidSplashIcon(
      logoSvg
        .replace("M10 10H20", "M397.947 166.36M114.087 344.893")
        .replace('stroke-width="4"', 'stroke-width="17.928"'),
    );
    const viewportWidth = Number(drawable.match(/android:viewportWidth="([\d.]+)"/)?.[1]);
    const strokeWidth = Number(drawable.match(/android:strokeWidth="([\d.]+)"/)?.[1]);
    const translateX = Number(drawable.match(/android:translateX="([\d.]+)"/)?.[1] ?? 0);
    const translateY = Number(drawable.match(/android:translateY="([\d.]+)"/)?.[1] ?? 0);
    const safeRadius = viewportWidth / 3;
    const center = viewportWidth / 2;
    const clippedExtrema = [
      { x: 397.947, y: 166.36 },
      { x: 114.087, y: 344.893 },
    ];

    for (const point of clippedExtrema) {
      const distanceFromCenter = Math.hypot(
        point.x + translateX - center,
        point.y + translateY - center,
      );

      expect(distanceFromCenter + strokeWidth / 2).toBeLessThanOrEqual(safeRadius);
    }
  });
});
