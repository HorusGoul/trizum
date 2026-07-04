import { Trans } from "@lingui/react/macro";
import { Link } from "react-aria-components";
import { Icon } from "#src/ui/Icon.js";
import { cn } from "#src/ui/utils.js";

export function NoActivePartiesCard() {
  return (
    <section className="flex flex-col items-center justify-center gap-5 px-4 py-12 text-center">
      <div className="bg-accent-100 text-accent-700 dark:bg-accent-800 dark:text-accent-200 rounded-full p-4">
        <Icon icon="lucide.folder-archive" width={22} height={22} />
      </div>

      <div className="max-w-md">
        <h2 className="text-accent-950 dark:text-accent-50 text-xl font-semibold">
          <Trans>No active parties right now</Trans>
        </h2>
        <p className="text-accent-700 dark:text-accent-300 mt-2 text-sm">
          <Trans>
            Everything is archived for now. You can reopen any party from the archived screen
            whenever you need it.
          </Trans>
        </p>
      </div>

      <Link
        href={{ to: "/archived" }}
        className={({ isPressed, isFocusVisible, isHovered, defaultClassName }) =>
          cn(
            defaultClassName,
            "inline-flex items-center justify-center rounded-full bg-accent-500 px-4 py-2.5 text-sm font-semibold text-accent-50 outline-none transition-all duration-200 ease-in-out dark:bg-accent-500",
            (isHovered || isFocusVisible) && "bg-accent-600 dark:bg-accent-400",
            isPressed && "scale-95 bg-accent-700 dark:bg-accent-300",
          )
        }
      >
        <Trans>Open archived parties</Trans>
      </Link>
    </section>
  );
}
