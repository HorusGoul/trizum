import { describe, expect, test } from "vite-plus/test";
import { generateCssVariables } from "./css.js";
import { getVariables } from "./runtime.js";

describe("@trizum/tw-dynamic-themes", () => {
  test("generates Tailwind v4 theme variables backed by runtime variables", () => {
    expect(generateCssVariables("accent", 250)).toBe(
      [
        "@theme {",
        "  --color-accent-50: oklch(var(--accent-50, 0.978 0.011 250.000));",
        "  --color-accent-100: oklch(var(--accent-100, 0.936 0.033 250.000));",
        "  --color-accent-200: oklch(var(--accent-200, 0.851 0.077 250.000));",
        "  --color-accent-300: oklch(var(--accent-300, 0.767 0.128 250.000));",
        "  --color-accent-400: oklch(var(--accent-400, 0.682 0.155 250.000));",
        "  --color-accent-500: oklch(var(--accent-500, 0.598 0.136 250.000));",
        "  --color-accent-600: oklch(var(--accent-600, 0.513 0.116 250.000));",
        "  --color-accent-700: oklch(var(--accent-700, 0.429 0.097 250.000));",
        "  --color-accent-800: oklch(var(--accent-800, 0.344 0.078 250.000));",
        "  --color-accent-900: oklch(var(--accent-900, 0.260 0.059 250.000));",
        "  --color-accent-950: oklch(var(--accent-950, 0.218 0.049 250.000));",
        "}",
      ].join("\n"),
    );
  });

  test("keeps runtime variables on the non-Tailwind names consumed by generated CSS", () => {
    expect(getVariables({ baseName: "accent", hue: 250 })).toEqual([
      ["--accent-50", "0.978 0.011 250.000"],
      ["--accent-100", "0.936 0.033 250.000"],
      ["--accent-200", "0.851 0.077 250.000"],
      ["--accent-300", "0.767 0.128 250.000"],
      ["--accent-400", "0.682 0.155 250.000"],
      ["--accent-500", "0.598 0.136 250.000"],
      ["--accent-600", "0.513 0.116 250.000"],
      ["--accent-700", "0.429 0.097 250.000"],
      ["--accent-800", "0.344 0.078 250.000"],
      ["--accent-900", "0.260 0.059 250.000"],
      ["--accent-950", "0.218 0.049 250.000"],
    ]);
  });
});
