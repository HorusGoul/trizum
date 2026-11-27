import { Trans } from "@lingui/react/macro";
import { Link } from "react-aria-components";
import { useAppSession } from "#src/lib/auth-client.ts";
import { Icon } from "@trizum/ui/Icon";
import { cn } from "@trizum/ui/utils";

export function EmptyState() {
  const session = useAppSession();
  const isSignedIn = Boolean(session.data?.user);

  return (
    <main className="pb-safe-offset-8 container flex flex-1 flex-col items-center px-4 [@media(max-height:600px)]:pb-0! [@media(max-height:720px)]:pb-2">
      <div className="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 [@media(max-height:600px)]:gap-2! [@media(max-height:720px)]:gap-3">
        <Icon
          icon="illustration.shared-expenses"
          className="h-auto w-full max-w-72 text-neutral-600 [--shared-expenses-surface:var(--color-accent-100)] dark:text-neutral-400 dark:[--shared-expenses-surface:var(--color-accent-950)] [@media(max-height:600px)]:max-w-40! [@media(max-height:720px)]:max-w-48"
          width={620}
          height={560}
        />

        <div className="flex flex-col items-center gap-3 text-center [@media(max-height:720px)]:gap-2">
          <h2 className="text-3xl font-bold tracking-tight [@media(max-height:720px)]:text-2xl">
            <Trans>Split expenses, stay even.</Trans>
          </h2>
          <p className="max-w-sm text-base leading-relaxed text-neutral-700 dark:text-neutral-300 [@media(max-height:600px)]:hidden [@media(max-height:720px)]:text-sm [@media(max-height:720px)]:leading-snug">
            <Trans>
              Create a party in seconds, track who paid, and settle up without the awkward maths.
            </Trans>
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 [@media(max-height:720px)]:gap-2">
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
              "border-neutral-200 bg-neutral-100/60 dark:border-neutral-800 dark:bg-neutral-900 flex w-full scale-100 items-center gap-3 rounded-2xl border p-4 text-start outline-hidden transition-all duration-200 [@media(max-height:720px)]:gap-2 [@media(max-height:720px)]:p-3 [@media(max-height:600px)]:p-2!",
              (isHovered || isFocusVisible) &&
                "border-neutral-400 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800",
              isPressed && "scale-[0.98]",
            )
          }
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 [@media(max-height:720px)]:size-10">
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
            <span className="text-sm leading-snug text-neutral-700 dark:text-neutral-300 [@media(max-height:600px)]:hidden">
              {isSignedIn ? (
                <Trans>Manage your cloud account and synced data.</Trans>
              ) : (
                <Trans>Securely access your data on all your devices.</Trans>
              )}
            </span>
          </span>
          <span className="shrink-0 rounded-full border border-neutral-400 px-3 py-1.5 text-sm font-semibold text-neutral-700 dark:border-neutral-600 dark:text-neutral-300">
            {isSignedIn ? <Trans>Manage</Trans> : <Trans>Sign in</Trans>}
          </span>
        </Link>

        <Link
          href={{ to: "/migrate/tricount" }}
          className={({ isPressed, isFocusVisible, isHovered, defaultClassName }) =>
            cn(
              defaultClassName,
              "text-neutral-700 dark:text-neutral-300 flex scale-100 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium outline-hidden transition-all",
              (isHovered || isFocusVisible) && "bg-neutral-950/5 dark:bg-neutral-50/5",
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
            ? "border-neutral-500 bg-neutral-500 text-neutral-50"
            : "border-neutral-500 bg-white dark:border-neutral-700 dark:bg-neutral-900",
          (isHovered || isFocusVisible) &&
            (color === "accent"
              ? "border-neutral-600 bg-neutral-600 dark:border-neutral-400 dark:bg-neutral-400"
              : "ring-neutral-500 dark:ring-neutral-400 ring-2"),
          isPressed && "scale-95",
        )
      }
    >
      <Icon icon={icon} width={20} height={20} />
      {children}
    </Link>
  );
}
