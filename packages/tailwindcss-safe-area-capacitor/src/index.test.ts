import { describe, expect, it } from "vite-plus/test";
import safeArea from "./index.js";
import type { PluginAPI } from "tailwindcss/plugin";

type MatcherUtilities = Parameters<PluginAPI["matchUtilities"]>[0];

interface CapturedMatcher {
  utilities: MatcherUtilities;
}

describe("tailwindcss-safe-area-capacitor", () => {
  it("registers base, offset, and fallback safe-area utilities", () => {
    const utilities: Record<string, unknown> = {};
    const matchers: CapturedMatcher[] = [];

    safeArea.handler({
      addBase: () => {},
      addComponents: () => {},
      addUtilities: (value) => {
        Object.assign(utilities, value);
      },
      addVariant: () => {},
      config: () => undefined,
      matchComponents: () => {},
      matchUtilities: (value) => {
        matchers.push({ utilities: value });
      },
      matchVariant: () => {},
      prefix: (className) => className,
      theme: () => ({
        "4": "1rem",
        "6": "1.5rem",
      }),
    });

    expect(utilities[".pt-safe"]).toEqual({
      paddingTop: "var(--safe-area-inset-top)",
    });

    expect(matchers[0]?.utilities["pt-safe-offset"]("1rem", { modifier: null })).toEqual({
      paddingTop: "calc(var(--safe-area-inset-top) + 1rem)",
    });

    expect(matchers[1]?.utilities["px-safe-or"]("1rem", { modifier: null })).toEqual({
      paddingRight: "max(var(--safe-area-inset-right), 1rem)",
      paddingLeft: "max(var(--safe-area-inset-left), 1rem)",
    });
  });
});
