import { Trans } from "@lingui/react/macro";
import { Link } from "react-aria-components";
import { Icon } from "@trizum/ui/Icon";
import { cn } from "@trizum/ui/utils";

export function NoActivePartiesCard() {
  return (
    <section className="flex flex-col items-center justify-center gap-5 px-4 py-12 text-center">
      <div className="rounded-full bg-neutral-100 p-4 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
        <Icon icon="lucide.folder-archive" width={22} height={22} />
      </div>

      <div className="max-w-md">
        <h2 className="text-xl font-semibold text-neutral-950 dark:text-neutral-50">
          <Trans>No active parties right now</Trans>
        </h2>
        <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
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
            "inline-flex items-center justify-center rounded-full bg-neutral-500 px-4 py-2.5 text-sm font-semibold text-neutral-50 outline-hidden transition-all duration-200 ease-in-out dark:bg-neutral-500",
            (isHovered || isFocusVisible) && "bg-neutral-600 dark:bg-neutral-400",
            isPressed && "scale-95 bg-neutral-700 dark:bg-neutral-300",
          )
        }
      >
        <Trans>Open archived parties</Trans>
      </Link>
    </section>
  );
}
