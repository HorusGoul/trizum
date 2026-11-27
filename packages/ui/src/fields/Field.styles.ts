import { cn, cva } from "../utils.js";

/**
 * Borderless field surface shared by inputs, select triggers, date fields, and
 * `input-like` buttons.
 *
 * Light mode: white with `shadow-surface`, plus a faint inset ring so the field
 * still reads on a white card or overlay. Dark mode: a translucent white fill,
 * which matches `neutral-900` on the black canvas and always lands one step
 * lighter than the card, sheet, or overlay the field sits on.
 */
export const fieldSurface =
  "bg-white text-neutral-950 shadow-surface inset-ring inset-ring-neutral-950/5 dark:bg-white/10 dark:text-neutral-50 dark:inset-ring-0";

/** Accent focus ring and danger ring for invalid fields. */
export const fieldFocusRing = cn([
  "data-[focused]:outline-hidden data-[focused]:ring-2 data-[focused]:ring-accent-500 dark:data-[focused]:ring-accent-400",
  "data-[invalid]:ring-2 data-[invalid]:ring-danger-500 dark:data-[invalid]:ring-danger-400",
  "data-[invalid]:data-[focused]:ring-danger-500 dark:data-[invalid]:data-[focused]:ring-danger-400",
]);

export const labelVariants = cn([
  "text-sm font-medium leading-none",
  /* Disabled */
  "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-70",
  /* Invalid */
  "group-data-[invalid]:text-danger-500",
]);

export const fieldGroupVariants = cva({
  variants: {
    variant: {
      default: cn([
        "relative flex h-10 w-full items-center overflow-hidden rounded-2xl px-3.5 py-2 text-sm",
        fieldSurface,
        /* Focus Within */
        "data-[focus-within]:outline-hidden data-[focus-within]:ring-2 data-[focus-within]:ring-accent-500 dark:data-[focus-within]:ring-accent-400",
        /* Invalid */
        "data-[invalid]:ring-2 data-[invalid]:ring-danger-500 dark:data-[invalid]:ring-danger-400",
        "data-[invalid]:data-[focus-within]:ring-danger-500 dark:data-[invalid]:data-[focus-within]:ring-danger-400",
        /* Disabled */
        "data-[disabled]:opacity-50",
      ]),
      ghost: "",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});
