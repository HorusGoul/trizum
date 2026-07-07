import { Fragment, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";
import {
  toastClassNames,
  toastIcons,
  toastMobileOffset,
  toastOffset,
  toastStyle,
} from "./Toaster.config";

describe("Toaster", () => {
  test("keeps toasts outside viewport safe areas", () => {
    expect(toastOffset).toEqual({
      top: "calc(var(--safe-area-inset-top) + 1.5rem)",
      right: "calc(var(--safe-area-inset-right) + 1.5rem)",
      bottom: "calc(var(--safe-area-inset-bottom) + 1.5rem)",
      left: "calc(var(--safe-area-inset-left) + 1.5rem)",
    });

    expect(toastMobileOffset).toEqual({
      top: "calc(var(--safe-area-inset-top) + 1rem)",
      right:
        "max(calc(var(--safe-area-inset-left) + 1rem), calc(var(--safe-area-inset-right) + 1rem))",
      bottom: "calc(var(--safe-area-inset-bottom) + 1rem)",
      left: "max(calc(var(--safe-area-inset-left) + 1rem), calc(var(--safe-area-inset-right) + 1rem))",
    });
    expect(toastStyle["--width"]).toBe("min(24rem, calc(100vw - 2rem))");
  });

  test("uses PWA design-system classes for toast surfaces", () => {
    expect(toastClassNames.toast).toContain("rounded-lg");
    expect(toastClassNames.toast).toContain("bg-white");
    expect(toastClassNames.toast).toContain("dark:bg-accent-900");
    expect(toastClassNames.actionButton).toContain("bg-accent-500");
    expect(toastClassNames.success).toContain("bg-success-50");
    expect(toastClassNames.error).toContain("bg-danger-50");
    expect(toastClassNames.warning).toContain("bg-warning-50");
  });

  test("uses the app icon sprite for toast states", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        toastIcons.success,
        toastIcons.info,
        toastIcons.warning,
        toastIcons.error,
        toastIcons.loading,
      ),
    );

    expect(markup).toContain("#lucide.circle-check");
    expect(markup).toContain("#lucide.info");
    expect(markup).toContain("#lucide.triangle-alert");
    expect(markup).toContain("#lucide.circle-alert");
    expect(markup).toContain("#lucide.loader-circle");
  });
});
