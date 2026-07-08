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

  test("uses restrained PWA design-system classes for toast surfaces", () => {
    expect(toastClassNames.toast).toContain("relative");
    expect(toastClassNames.toast).toContain("items-center");
    expect(toastClassNames.toast).toContain("rounded-lg");
    expect(toastClassNames.toast).toContain("border-accent-200/80");
    expect(toastClassNames.toast).toContain("bg-white");
    expect(toastClassNames.toast).toContain("before:w-1");
    expect(toastClassNames.toast).toContain("dark:bg-accent-900");
    expect(toastClassNames.title).toContain("font-medium");
    expect(toastClassNames.description).toContain("font-normal");
    expect(toastClassNames.actionButton).toContain("font-medium");
    expect(toastClassNames.icon).toContain("text-accent-900");
    expect(toastClassNames.icon).toContain("dark:text-accent-50");
    expect(toastClassNames.success).toContain("before:bg-success-500");
    expect(toastClassNames.error).toContain("before:bg-danger-500");
    expect(toastClassNames.warning).toContain("before:bg-warning-500");

    const classNames = Object.values(toastClassNames).join(" ");
    const classNameTokens = classNames.split(/\s+/);
    expect(classNames).not.toContain("text-success");
    expect(classNames).not.toContain("text-danger");
    expect(classNames).not.toContain("text-warning");
    expect(classNameTokens).not.toContain("bg-success-50");
    expect(classNameTokens).not.toContain("bg-danger-50");
    expect(classNameTokens).not.toContain("bg-warning-50");
  });

  test("uses the app icon sprite without toast-specific stroke overrides", () => {
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
    expect(markup).toContain("size-[18px]");
    expect(markup).not.toContain("stroke-[");
  });
});
