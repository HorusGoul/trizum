import { createElement, type CSSProperties } from "react";
import type { ToastClassnames, ToasterProps } from "sonner";
import { Icon } from "./Icon";
import { cn } from "./utils";

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

export const toastClassNames = {
  toast: cn(
    "pointer-events-auto flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-sm",
    "border-white/10 bg-black text-white shadow-lg shadow-black/30 backdrop-blur-sm",
    "outline-hidden ring-offset-black",
    "dark:border-white/10 dark:bg-black dark:text-white dark:shadow-none dark:ring-offset-black",
  ),
  title: "text-sm leading-5 font-medium",
  description: "mt-0.5 text-sm leading-5 font-normal text-white/75 dark:text-white/75",
  content: "flex min-w-0 flex-1 flex-col justify-center",
  icon: "flex size-5 shrink-0 items-center justify-center text-accent-300 dark:text-accent-300",
  loader:
    "!static flex size-5 shrink-0 !transform-none items-center justify-center text-white/80 dark:text-white/80",
  closeButton: cn(
    "absolute -top-2 -left-2 flex size-6 items-center justify-center rounded-full border",
    "border-white/10 bg-black text-white/70 shadow-xs outline-hidden transition-colors",
    "hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black",
    "dark:border-white/10 dark:bg-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-white dark:focus-visible:ring-offset-black",
  ),
  actionButton: cn(
    "inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3 text-sm font-medium outline-hidden transition-all duration-200 ease-in-out",
    "bg-white text-black hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-95",
    "dark:bg-white dark:text-black dark:hover:bg-white/90 dark:focus-visible:ring-white dark:focus-visible:ring-offset-black",
  ),
  cancelButton: cn(
    "inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3 text-sm font-medium outline-hidden transition-colors",
    "bg-white/10 text-white hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black",
    "dark:bg-white/10 dark:text-white dark:hover:bg-white/15 dark:focus-visible:ring-white dark:focus-visible:ring-offset-black",
  ),
  success: "[&_[data-icon]]:text-success-400 dark:[&_[data-icon]]:text-success-400",
  error: "[&_[data-icon]]:text-danger-400 dark:[&_[data-icon]]:text-danger-400",
  info: "[&_[data-icon]]:text-accent-300 dark:[&_[data-icon]]:text-accent-300",
  warning: "[&_[data-icon]]:text-warning-400 dark:[&_[data-icon]]:text-warning-400",
  loading: "[&_[data-icon]]:text-white/80 dark:[&_[data-icon]]:text-white/80",
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
