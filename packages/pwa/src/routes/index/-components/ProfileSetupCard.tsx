import { Trans } from "@lingui/react/macro";
import { Link } from "react-aria-components";
import { Icon } from "@trizum/ui/Icon";
import { cn } from "@trizum/ui/utils";

export function ProfileSetupCard() {
  return (
    <Link
      href={{ to: "/settings" }}
      className={({ isPressed, isFocusVisible, isHovered, defaultClassName }) =>
        cn(
          defaultClassName,
          "flex scale-100 items-start gap-4 rounded-xl border border-neutral-400 bg-neutral-50 p-4 text-start outline-hidden transition-all duration-200 ease-in-out dark:border-neutral-500 dark:bg-black",
          (isHovered || isFocusVisible) &&
            "border-neutral-500 shadow-md dark:border-neutral-400 dark:bg-neutral-900 dark:shadow-none",
          isPressed &&
            "scale-95 border-neutral-600 bg-neutral-50/90 shadow-lg dark:border-neutral-300 dark:bg-neutral-800/90 dark:shadow-none",
        )
      }
    >
      <div className="-mt-0.5 flex h-8 w-8 shrink-0 justify-center">
        <Icon icon="lucide.user-round-pen" className="text-neutral-600 dark:text-neutral-400" />
      </div>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-lg leading-tight font-semibold text-neutral-950 dark:text-neutral-50">
          <Trans>Complete your profile</Trans>
        </span>
        <span className="text-sm text-neutral-600 dark:text-neutral-400">
          <Trans>Add your name so others know who you are and how to pay you</Trans>
        </span>
      </div>
    </Link>
  );
}
