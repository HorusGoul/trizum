import { Trans } from "@lingui/react/macro";
import { Link } from "react-aria-components";
import { authClient } from "#src/lib/auth-client.ts";
import { Icon } from "#src/ui/Icon.js";
import { cn } from "#src/ui/utils.js";

export function EmptyState() {
  const session = authClient.useSession();
  const isSignedIn = Boolean(session.data?.user);

  return (
    <main className="pb-safe-offset-8 container flex flex-1 flex-col items-center px-4">
      <div className="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6">
        <Icon
          icon="illustration.shared-expenses"
          className="text-accent-600 dark:text-accent-400 h-auto w-full max-w-72 [--shared-expenses-surface:var(--color-accent-100)] dark:[--shared-expenses-surface:var(--color-accent-950)]"
          width={620}
          height={560}
        />

        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            <Trans>Split expenses, stay even.</Trans>
          </h2>
          <p className="text-accent-700 dark:text-accent-300 max-w-sm text-base leading-relaxed">
            <Trans>
              Create a party in seconds, track who paid, and settle up without the awkward maths.
            </Trans>
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <ActionLink href={{ to: "/new" }} icon="lucide.list-plus" color="accent">
            <Trans>Create a Party</Trans>
          </ActionLink>
          <ActionLink href={{ to: "/join" }} icon="lucide.ampersand">
            <Trans>Join with a code</Trans>
          </ActionLink>
        </div>

        <Link
          href={{ to: "/settings/cloud-sync" }}
          routerOptions={{ resetScroll: false }}
          className={({ isPressed, isFocusVisible, isHovered, defaultClassName }) =>
            cn(
              defaultClassName,
              "border-accent-200 bg-accent-100/60 dark:border-accent-800 dark:bg-accent-900 flex w-full scale-100 items-center gap-3 rounded-2xl border p-4 text-start outline-hidden transition-all duration-200",
              (isHovered || isFocusVisible) &&
                "border-accent-400 bg-accent-100 dark:border-accent-600 dark:bg-accent-800",
              isPressed && "scale-[0.98]",
            )
          }
        >
          <span className="bg-accent-200 text-accent-700 dark:bg-accent-800 dark:text-accent-200 flex size-11 shrink-0 items-center justify-center rounded-full">
            <Icon
              icon={isSignedIn ? "lucide.cloud-check" : "lucide.cloud"}
              width={22}
              height={22}
            />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-semibold">
              <Trans>Keep every party in sync</Trans>
            </span>
            <span className="text-accent-700 dark:text-accent-300 text-sm leading-snug">
              {isSignedIn ? (
                <Trans>Manage your cloud account and synced data.</Trans>
              ) : (
                <Trans>Securely access your data on all your devices.</Trans>
              )}
            </span>
          </span>
          <span className="border-accent-400 text-accent-700 dark:border-accent-600 dark:text-accent-300 shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold">
            {isSignedIn ? <Trans>Manage</Trans> : <Trans>Sign in</Trans>}
          </span>
        </Link>

        <Link
          href={{ to: "/migrate/tricount" }}
          className={({ isPressed, isFocusVisible, isHovered, defaultClassName }) =>
            cn(
              defaultClassName,
              "text-accent-700 dark:text-accent-300 flex scale-100 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium outline-hidden transition-all",
              (isHovered || isFocusVisible) && "bg-accent-950/5 dark:bg-accent-50/5",
              isPressed && "scale-95",
            )
          }
        >
          <Icon icon="lucide.import" width={18} height={18} />
          <Trans>Import from Tricount</Trans>
        </Link>
      </div>
    </main>
  );
}

function ActionLink({
  href,
  icon,
  color = "input-like",
  children,
}: {
  href: React.ComponentProps<typeof Link>["href"];
  icon: React.ComponentProps<typeof Icon>["icon"];
  color?: "accent" | "input-like";
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={({ isPressed, isFocusVisible, isHovered, defaultClassName }) =>
        cn(
          defaultClassName,
          "flex h-12 w-full scale-100 items-center justify-center gap-2 rounded-full border font-semibold outline-hidden transition-all duration-200",
          color === "accent"
            ? "border-accent-500 bg-accent-500 text-accent-50"
            : "border-accent-500 bg-white dark:border-accent-700 dark:bg-accent-900",
          (isHovered || isFocusVisible) &&
            (color === "accent"
              ? "border-accent-600 bg-accent-600 dark:border-accent-400 dark:bg-accent-400"
              : "ring-accent-500 dark:ring-accent-400 ring-2"),
          isPressed && "scale-95",
        )
      }
    >
      <Icon icon={icon} width={20} height={20} />
      {children}
    </Link>
  );
}
