import { Trans } from "@lingui/react/macro";
import { Link } from "react-aria-components";
import { Icon } from "#src/ui/Icon.js";
import { cn } from "#src/ui/utils.js";

export function EmptyState() {
  return (
    <div className="container flex flex-1 flex-col items-center justify-center gap-8 px-4">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-bold">
          <Trans>Welcome to trizum</Trans>
        </h1>
        <p className="text-lg text-accent-700 dark:text-accent-300">
          <Trans>
            Split bills with friends and family. Track expenses, calculate balances, and settle up
            together.
          </Trans>
        </p>
      </div>

      <div className="flex w-full max-w-md flex-col gap-4">
        <EmptyStateLink
          href={{ to: "/new" }}
          icon="lucide.list-plus"
          title={<Trans>Create a new Party</Trans>}
          description={<Trans>Start tracking expenses with your group</Trans>}
        />
        <EmptyStateLink
          href={{ to: "/join" }}
          icon="lucide.ampersand"
          title={<Trans>Join a Party</Trans>}
          description={<Trans>Enter a party link or code to join</Trans>}
        />
        <EmptyStateLink
          href={{ to: "/migrate/tricount" }}
          icon="lucide.import"
          title={<Trans>Migrate from Tricount</Trans>}
          description={<Trans>Import your existing Tricount data</Trans>}
        />
        <EmptyStateLink
          href={{ to: "/settings" }}
          icon="lucide.user"
          title={<Trans>Configure Profile</Trans>}
          description={<Trans>Set up your username, avatar, and preferences</Trans>}
        />
      </div>
    </div>
  );
}

function EmptyStateLink({
  href,
  icon,
  title,
  description,
}: {
  href: React.ComponentProps<typeof Link>["href"];
  icon: React.ComponentProps<typeof Icon>["icon"];
  title: React.ReactNode;
  description: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={({ isPressed, isFocusVisible, isHovered, defaultClassName }) =>
        cn(
          defaultClassName,
          "flex scale-100 items-start gap-4 rounded-xl border border-accent-200 bg-white p-4 text-start outline-none transition-all duration-200 ease-in-out dark:border-accent-800 dark:bg-accent-900",
          (isHovered || isFocusVisible) &&
            "shadow-md dark:border-accent-700 dark:bg-accent-800 dark:shadow-none",
          isPressed && "scale-95 bg-opacity-90 shadow-lg dark:bg-accent-700 dark:shadow-none",
        )
      }
    >
      <Icon icon={icon} width={24} height={24} className="text-accent-600 dark:text-accent-400" />
      <div className="flex flex-1 flex-col">
        <span className="text-lg font-semibold text-accent-950 dark:text-accent-50">{title}</span>
        <span className="text-sm text-accent-600 dark:text-accent-400">{description}</span>
      </div>
    </Link>
  );
}
