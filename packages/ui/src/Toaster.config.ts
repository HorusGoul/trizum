import { createElement, type CSSProperties } from "react";
import type { ToastClassnames, ToasterProps } from "sonner";
import { Icon } from "./Icon.js";
import { cn } from "./utils.js";

type Offset = NonNullable<ToasterProps["offset"]>;

type CssVariableStyles = CSSProperties & Record<`--${string}`, string | number>;

const desktopInset = "1.5rem";
const mobileInset = "1rem";

const mobileInlineOffset = [
  `calc(var(--safe-area-inset-left) + ${mobileInset})`,
  `calc(var(--safe-area-inset-right) + ${mobileInset})`,
].join(", ");

export const toastOffset = {
  top: `calc(var(--safe-area-inset-top) + ${desktopInset})`,
  right: `calc(var(--safe-area-inset-right) + ${desktopInset})`,
  bottom: `calc(var(--safe-area-inset-bottom) + ${desktopInset})`,
  left: `calc(var(--safe-area-inset-left) + ${desktopInset})`,
} satisfies Offset;

export const toastMobileOffset = {
  top: `calc(var(--safe-area-inset-top) + ${mobileInset})`,
  right: `max(${mobileInlineOffset})`,
  bottom: `calc(var(--safe-area-inset-bottom) + ${mobileInset})`,
  left: `max(${mobileInlineOffset})`,
} satisfies Offset;

export const toastStyle: CssVariableStyles = {
  "--width": "min(24rem, calc(100vw - 2rem))",
};

export const toastTheme = "dark" satisfies NonNullable<ToasterProps["theme"]>;

export const toastClassNames = {
  toast: cn(
    "pointer-events-auto flex w-full items-center gap-3 rounded-3xl px-4 py-3.5 text-sm select-none",
    "bg-white text-neutral-950 shadow-overlay",
    "outline-hidden focus-visible:ring-2 focus-visible:ring-accent-500",
    "dark:bg-neutral-800 dark:text-neutral-50 dark:focus-visible:ring-accent-400",
  ),
  title: "text-sm leading-5 font-medium",
  description: "mt-0.5 text-sm leading-5 font-normal text-neutral-600 dark:text-neutral-400",
  content: "flex min-w-0 flex-1 flex-col justify-center",
  icon: "flex size-5 shrink-0 items-center justify-center text-neutral-500 dark:text-neutral-400",
  loader:
    "!static flex size-5 shrink-0 !transform-none items-center justify-center text-neutral-500 dark:text-neutral-400",
  closeButton: cn(
    "absolute -top-1 -left-1 flex size-6 items-center justify-center rounded-full",
    "bg-white text-neutral-600 shadow-raised outline-hidden transition-colors",
    "hover:bg-neutral-100 hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-accent-500",
    "dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600 dark:hover:text-neutral-50 dark:focus-visible:ring-accent-400",
  ),
  actionButton: cn(
    "inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3.5 text-xs font-medium outline-hidden transition-all duration-200 ease-in-out",
    "bg-accent-500 text-white hover:bg-accent-600 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-95",
    "dark:bg-accent-500 dark:text-white dark:hover:bg-accent-600 dark:focus-visible:ring-accent-400 dark:focus-visible:ring-offset-neutral-800",
  ),
  cancelButton: cn(
    "inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3.5 text-xs font-medium outline-hidden transition-colors",
    "bg-neutral-950/5 text-neutral-950 hover:bg-neutral-950/10 focus-visible:ring-2 focus-visible:ring-accent-500",
    "dark:bg-white/10 dark:text-neutral-50 dark:hover:bg-white/15 dark:focus-visible:ring-accent-400",
  ),
  success: "[&_[data-icon]]:text-success-600 dark:[&_[data-icon]]:text-success-400",
  error: "[&_[data-icon]]:text-danger-600 dark:[&_[data-icon]]:text-danger-400",
  info: "[&_[data-icon]]:text-neutral-500 dark:[&_[data-icon]]:text-neutral-400",
  warning: "[&_[data-icon]]:text-warning-600 dark:[&_[data-icon]]:text-warning-400",
  loading: "[&_[data-icon]]:text-neutral-500 dark:[&_[data-icon]]:text-neutral-400",
} satisfies ToastClassnames;

export const toastIcons = {
  success: createElement(Icon, {
    icon: "lucide.circle-check",
    className: "size-[18px]",
  }),
  info: createElement(Icon, {
    icon: "lucide.info",
    className: "size-[18px]",
  }),
  warning: createElement(Icon, {
    icon: "lucide.triangle-alert",
    className: "size-[18px]",
  }),
  error: createElement(Icon, {
    icon: "lucide.circle-alert",
    className: "size-[18px]",
  }),
  loading: createElement(Icon, {
    icon: "lucide.loader-circle",
    className: "size-[18px] animate-spin",
  }),
  close: createElement(Icon, { icon: "lucide.x", className: "size-3.5" }),
} satisfies NonNullable<ToasterProps["icons"]>;
