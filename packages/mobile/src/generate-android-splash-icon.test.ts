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
});
