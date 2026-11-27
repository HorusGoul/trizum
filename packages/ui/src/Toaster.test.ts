import { IconSpriteContext } from "./iconSpriteContext.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";
import {
  toastClassNames,
  toastIcons,
  toastMobileOffset,
  toastOffset,
  toastStyle,
  toastTheme,
} from "./Toaster.config.js";

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

  test("uses borderless overlay toast surfaces with semantic icon color", () => {
    expect(toastClassNames.toast).toContain("items-center");
    expect(toastClassNames.toast).toContain("rounded-3xl");
    expect(toastClassNames.toast).toContain("shadow-overlay");
    expect(toastClassNames.toast).toContain("bg-white");
    expect(toastClassNames.toast).toContain("text-neutral-950");
    expect(toastClassNames.toast).toContain("dark:bg-neutral-800");
    expect(toastClassNames.toast).toContain("dark:text-neutral-50");
    expect(toastClassNames.title).toContain("font-medium");
    expect(toastClassNames.description).toContain("font-normal");
    expect(toastClassNames.description).toContain("text-neutral-600");
    expect(toastClassNames.description).toContain("dark:text-neutral-400");
    expect(toastClassNames.icon).toContain("text-neutral-500");
    expect(toastClassNames.success).toContain("[&_[data-icon]]:text-success-600");
    expect(toastClassNames.success).toContain("dark:[&_[data-icon]]:text-success-400");
    expect(toastClassNames.error).toContain("[&_[data-icon]]:text-danger-600");
    expect(toastClassNames.error).toContain("dark:[&_[data-icon]]:text-danger-400");
    expect(toastClassNames.warning).toContain("[&_[data-icon]]:text-warning-600");
    expect(toastClassNames.warning).toContain("dark:[&_[data-icon]]:text-warning-400");
    expect(toastClassNames.info).toContain("[&_[data-icon]]:text-neutral-500");
    expect(toastClassNames.loading).toContain("[&_[data-icon]]:text-neutral-500");

    const classNames = Object.values(toastClassNames).join(" ");
    const classNameTokens = classNames.split(/\s+/);
    expect(classNames).not.toContain("before:");
    expect(classNameTokens).not.toContain("border");
    expect(classNameTokens).not.toContain("dark:shadow-none");
    expect(classNameTokens).not.toContain("bg-success-50");
    expect(classNameTokens).not.toContain("bg-danger-50");
    expect(classNameTokens).not.toContain("bg-warning-50");
  });

  test("keeps loading and action toasts legible on the overlay surface", () => {
    expect(toastClassNames.loader).toContain("flex");
    expect(toastClassNames.loader).toContain("size-5");
    expect(toastClassNames.loader).toContain("shrink-0");
    expect(toastClassNames.loader).toContain("!static");
    expect(toastClassNames.loader).toContain("!transform-none");
    expect(toastClassNames.loader).toContain("items-center");
    expect(toastClassNames.loader).toContain("text-neutral-500");
    expect(toastClassNames.actionButton).toContain("h-8");
    expect(toastClassNames.actionButton).toContain("rounded-full");
    expect(toastClassNames.actionButton).toContain("text-xs");
    expect(toastClassNames.actionButton).toContain("font-medium");
    expect(toastClassNames.actionButton).toContain("bg-accent-500");
    expect(toastClassNames.actionButton).toContain("text-white");
    expect(toastClassNames.actionButton).toContain("focus-visible:ring-accent-500");
    expect(toastClassNames.cancelButton).toContain("h-8");
    expect(toastClassNames.cancelButton).toContain("rounded-full");
    expect(toastClassNames.cancelButton).toContain("text-xs");
    expect(toastClassNames.cancelButton).toContain("bg-neutral-950/5");
    expect(toastClassNames.cancelButton).toContain("dark:bg-white/10");
    expect(toastClassNames.closeButton).toContain("shadow-raised");
  });

  test("uses the app icon sprite without toast-specific stroke overrides", () => {
    const markup = renderToStaticMarkup(
      createElement(
        IconSpriteContext,
        { value: "/sprite.svg" },
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
