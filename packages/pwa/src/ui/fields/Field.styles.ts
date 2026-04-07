import { cn, cva } from "../utils";

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
        "relative flex h-10 w-full items-center overflow-hidden rounded-md border border-accent-500 dark:border-accent-700 bg-white dark:bg-accent-900 px-3 py-2 text-sm ring-offset-white dark:ring-offset-accent-900",
        /* Focus Within */
        "data-[focus-within]:outline-none data-[focus-within]:ring-2 data-[focus-within]:ring-ring data-[focus-within]:ring-offset-2",
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
