import { Fragment, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";
import {
  toastClassNames,
  toastIcons,
  toastMobileOffset,
  toastOffset,
  toastStyle,
  toastTheme,
} from "./Toaster.config";

describe("Toaster", () => {
  test("uses the app's dark-only theme", () => {
    expect(toastTheme).toBe("dark");
  });

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

  test("uses black toast surfaces with semantic icon color", () => {
    expect(toastClassNames.toast).toContain("items-center");
    expect(toastClassNames.toast).toContain("rounded-lg");
    expect(toastClassNames.toast).toContain("border-white/10");
    expect(toastClassNames.toast).toContain("bg-black");
    expect(toastClassNames.toast).toContain("text-white");
    expect(toastClassNames.toast).toContain("ring-offset-black");
    expect(toastClassNames.toast).toContain("dark:bg-black");
    expect(toastClassNames.title).toContain("font-medium");
    expect(toastClassNames.description).toContain("font-normal");
    expect(toastClassNames.description).toContain("text-white/75");
    expect(toastClassNames.icon).toContain("text-accent-300");
    expect(toastClassNames.success).toContain("[&_[data-icon]]:text-success-400");
    expect(toastClassNames.error).toContain("[&_[data-icon]]:text-danger-400");
    expect(toastClassNames.warning).toContain("[&_[data-icon]]:text-warning-400");
    expect(toastClassNames.info).toContain("[&_[data-icon]]:text-accent-300");
    expect(toastClassNames.loading).toContain("[&_[data-icon]]:text-white/80");

    const classNames = Object.values(toastClassNames).join(" ");
    const classNameTokens = classNames.split(/\s+/);
    expect(classNames).not.toContain("before:");
    expect(classNameTokens).not.toContain("bg-success-50");
    expect(classNameTokens).not.toContain("bg-danger-50");
    expect(classNameTokens).not.toContain("bg-warning-50");
  });

  test("keeps loading and action toasts legible on the black surface", () => {
    expect(toastClassNames.loader).toContain("flex");
    expect(toastClassNames.loader).toContain("size-5");
    expect(toastClassNames.loader).toContain("shrink-0");
    expect(toastClassNames.loader).toContain("!static");
    expect(toastClassNames.loader).toContain("!transform-none");
    expect(toastClassNames.loader).toContain("items-center");
    expect(toastClassNames.loader).toContain("text-white/80");
    expect(toastClassNames.actionButton).toContain("h-6");
    expect(toastClassNames.actionButton).toContain("rounded-md");
    expect(toastClassNames.actionButton).toContain("text-xs");
    expect(toastClassNames.actionButton).toContain("font-medium");
    expect(toastClassNames.actionButton).toContain("bg-white");
    expect(toastClassNames.actionButton).toContain("text-black");
    expect(toastClassNames.actionButton).toContain("focus-visible:ring-offset-black");
    expect(toastClassNames.cancelButton).toContain("h-6");
    expect(toastClassNames.cancelButton).toContain("rounded-md");
    expect(toastClassNames.cancelButton).toContain("text-xs");
    expect(toastClassNames.cancelButton).toContain("bg-white/10");
    expect(toastClassNames.cancelButton).toContain("text-white");
    expect(toastClassNames.cancelButton).toContain("focus-visible:ring-offset-black");
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
