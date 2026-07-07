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
    "pointer-events-auto flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-sm",
    "bg-white text-accent-950 shadow-lg shadow-accent-950/10 backdrop-blur-sm",
    "border-accent-200 outline-hidden ring-offset-white",
    "dark:border-accent-700 dark:bg-accent-900 dark:text-accent-50 dark:shadow-none dark:ring-offset-accent-950",
  ),
  title: "text-sm leading-snug font-medium",
  description: "mt-1 text-sm leading-snug opacity-80",
  content: "min-w-0 flex-1",
  icon: "mt-0.5 flex size-5 shrink-0 items-center justify-center",
  loader: "text-accent-600 dark:text-accent-300",
  closeButton: cn(
    "absolute -top-2 -left-2 flex size-6 items-center justify-center rounded-full border",
    "border-accent-200 bg-white text-accent-600 shadow-xs outline-hidden transition-colors",
    "hover:bg-accent-50 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2",
    "dark:border-accent-700 dark:bg-accent-900 dark:text-accent-200 dark:hover:bg-accent-800 dark:focus-visible:ring-accent-400",
  ),
  actionButton: cn(
    "inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3 text-sm font-semibold outline-hidden transition-all duration-200 ease-in-out",
    "bg-accent-500 text-accent-50 hover:bg-accent-600 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 active:scale-95",
    "dark:bg-accent-500 dark:hover:bg-accent-400 dark:focus-visible:ring-accent-400 dark:active:bg-accent-300",
  ),
  cancelButton: cn(
    "inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3 text-sm font-semibold outline-hidden transition-colors",
    "bg-accent-100 text-accent-700 hover:bg-accent-200 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2",
    "dark:bg-accent-800 dark:text-accent-50 dark:hover:bg-accent-700 dark:focus-visible:ring-accent-400",
  ),
  success: cn(
    "data-[type=success]:border-success-200 data-[type=success]:bg-success-50 data-[type=success]:text-success-900",
    "dark:data-[type=success]:border-success-800 dark:data-[type=success]:bg-success-950/70 dark:data-[type=success]:text-success-50",
    "[&_[data-icon]]:text-success-600 dark:[&_[data-icon]]:text-success-300",
  ),
  error: cn(
    "data-[type=error]:border-danger-200 data-[type=error]:bg-danger-50 data-[type=error]:text-danger-900",
    "dark:data-[type=error]:border-danger-800 dark:data-[type=error]:bg-danger-950/70 dark:data-[type=error]:text-danger-50",
    "[&_[data-icon]]:text-danger-600 dark:[&_[data-icon]]:text-danger-300",
  ),
  info: cn(
    "data-[type=info]:border-accent-200 data-[type=info]:bg-accent-50 data-[type=info]:text-accent-950",
    "dark:data-[type=info]:border-accent-700 dark:data-[type=info]:bg-accent-900 dark:data-[type=info]:text-accent-50",
    "[&_[data-icon]]:text-accent-600 dark:[&_[data-icon]]:text-accent-300",
  ),
  warning: cn(
    "data-[type=warning]:border-warning-200 data-[type=warning]:bg-warning-50 data-[type=warning]:text-warning-900",
    "dark:data-[type=warning]:border-warning-700 dark:data-[type=warning]:bg-warning-950/70 dark:data-[type=warning]:text-warning-50",
    "[&_[data-icon]]:text-warning-600 dark:[&_[data-icon]]:text-warning-300",
  ),
  loading: cn(
    "data-[type=loading]:border-accent-200 data-[type=loading]:bg-white data-[type=loading]:text-accent-950",
    "dark:data-[type=loading]:border-accent-700 dark:data-[type=loading]:bg-accent-900 dark:data-[type=loading]:text-accent-50",
    "[&_[data-icon]]:text-accent-600 dark:[&_[data-icon]]:text-accent-300",
  ),
} satisfies ToastClassnames;

export const toastIcons = {
  success: createElement(Icon, { icon: "lucide.circle-check", className: "size-5" }),
  info: createElement(Icon, { icon: "lucide.info", className: "size-5" }),
  warning: createElement(Icon, { icon: "lucide.triangle-alert", className: "size-5" }),
  error: createElement(Icon, { icon: "lucide.circle-alert", className: "size-5" }),
  loading: createElement(Icon, {
    icon: "lucide.loader-circle",
    className: "size-5 animate-spin",
  }),
  close: createElement(Icon, { icon: "lucide.x", className: "size-3.5" }),
} satisfies NonNullable<ToasterProps["icons"]>;
