import { Trans } from "@lingui/react/macro";
import { Link } from "react-aria-components";
import { Icon } from "#src/ui/Icon.js";
import { cn } from "#src/ui/utils.js";

export function ProfileSetupCard() {
  return (
    <Link
      href={{ to: "/settings" }}
      className={({ isPressed, isFocusVisible, isHovered, defaultClassName }) =>
        cn(
          defaultClassName,
          "flex scale-100 items-start gap-4 rounded-xl border border-accent-400 bg-accent-50 p-4 text-start outline-none transition-all duration-200 ease-in-out dark:border-accent-500 dark:bg-accent-950",
          (isHovered || isFocusVisible) &&
            "border-accent-500 shadow-md dark:border-accent-400 dark:bg-accent-900 dark:shadow-none",
          isPressed &&
            "scale-95 border-accent-600 bg-accent-50/90 shadow-lg dark:border-accent-300 dark:bg-accent-800 dark:shadow-none",
        )
      }
    >
      <div className="-mt-0.5 flex h-8 w-8 shrink-0 justify-center">
        <Icon icon="lucide.user-round-pen" className="text-accent-600 dark:text-accent-400" />
      </div>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-accent-950 dark:text-accent-50 text-lg leading-tight font-semibold">
          <Trans>Complete your profile</Trans>
        </span>
        <span className="text-accent-600 dark:text-accent-400 text-sm">
          <Trans>Add your name so others know who you are and how to pay you</Trans>
        </span>
      </div>
    </Link>
  );
}
