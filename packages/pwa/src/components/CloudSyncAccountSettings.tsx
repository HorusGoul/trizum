import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { type ReactNode } from "react";
import type { LinkedAuthAccount } from "#src/lib/auth-client.ts";
import { Button } from "#src/ui/Button.tsx";
import { Icon, type IconProps } from "#src/ui/Icon.tsx";
import { cn } from "#src/ui/utils.js";

export function CloudSyncAccountSettings({
  email,
  hasPasswordAccount,
  isAuthPending,
  isDeleteAccountPending,
  linkedProviderIds,
  onConnectApple,
  onConnectGoogle,
  onDeleteAccount,
  onPasswordLink,
  onSignOut,
  passwordResetMessage,
}: {
  email: string;
  hasPasswordAccount: boolean;
  isAuthPending: boolean;
  isDeleteAccountPending: boolean;
  linkedProviderIds: Set<LinkedAuthAccount["providerId"]>;
  onConnectApple: () => void;
  onConnectGoogle: () => void;
  onDeleteAccount: () => void;
  onPasswordLink: () => void;
  onSignOut: () => void;
  passwordResetMessage: string | null;
}) {
  return (
    <div className="pb-safe container mt-4 flex flex-col gap-8 px-4 pb-8">
      <CloudSettingsSection icon="lucide.link" title={t`Connections`}>
        <CloudSettingsItem
          icon="brand.apple"
          title={t`Apple`}
          description={
            linkedProviderIds.has("apple")
              ? t`Apple is connected to this account`
              : t`Add Apple as a sign-in method`
          }
          statusLabel={linkedProviderIds.has("apple") ? t`Connected` : undefined}
          isConnected={linkedProviderIds.has("apple")}
          isDisabled={isAuthPending || linkedProviderIds.has("apple")}
          onPress={linkedProviderIds.has("apple") ? undefined : onConnectApple}
        />
        <CloudSettingsItem
          icon="brand.google"
          title={t`Google`}
          description={
            linkedProviderIds.has("google")
              ? t`Google is connected to this account`
              : t`Add Google as a sign-in method`
          }
          statusLabel={linkedProviderIds.has("google") ? t`Connected` : undefined}
          isConnected={linkedProviderIds.has("google")}
          isDisabled={isAuthPending || linkedProviderIds.has("google")}
          onPress={linkedProviderIds.has("google") ? undefined : onConnectGoogle}
        />
      </CloudSettingsSection>

      <CloudSettingsSection icon="lucide.shield-check" title={t`Security`}>
        <CloudSettingsItem
          icon="lucide.mail"
          title={t`Email`}
          description={email}
          statusLabel={t`Signed in`}
          isConnected
        />
        <CloudSettingsItem
          icon="lucide.key-round"
          title={t`Password`}
          description={
            passwordResetMessage ??
            (hasPasswordAccount ? t`Email a password reset link` : t`Set up password sign-in`)
          }
          isDisabled={isAuthPending}
          onPress={onPasswordLink}
        />
        <CloudSettingsItem
          icon="lucide.log-out"
          title={t`Sign out`}
          description={t`Stop trizum cloud on this device`}
          isDisabled={isAuthPending}
          onPress={onSignOut}
        />
      </CloudSettingsSection>

      <CloudSettingsSection icon="lucide.triangle-alert" title={t`Destructive actions`}>
        <CloudSettingsItem
          icon="lucide.trash-2"
          title={t`Delete account`}
          description={t`Permanently delete your trizum cloud account`}
          isDisabled={isDeleteAccountPending}
          onPress={onDeleteAccount}
        />
      </CloudSettingsSection>
    </div>
  );
}

function CloudSettingsSection({
  children,
  icon,
  title,
  tone = "default",
}: {
  children: ReactNode;
  icon: IconProps["icon"];
  title: string;
  tone?: "default" | "danger";
}) {
  return (
    <section className="flex flex-col gap-2">
      <div
        className={cn(
          "flex items-center gap-2 px-1 text-sm font-semibold text-accent-700 dark:text-accent-200",
          tone === "danger" && "text-danger-600 dark:text-danger-300",
        )}
      >
        <Icon icon={icon} width={16} height={16} />
        <h2>{title}</h2>
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

function CloudSettingsItem({
  description,
  icon,
  isConnected,
  isDisabled,
  onPress,
  statusLabel,
  title,
  tone = "default",
}: {
  description?: ReactNode;
  icon: IconProps["icon"];
  isConnected?: boolean;
  isDisabled?: boolean;
  onPress?: () => void;
  statusLabel?: ReactNode;
  title: string;
  tone?: "default" | "danger";
}) {
  const content = (
    <span className="flex w-full items-center gap-3">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-50",
          tone === "danger" &&
            "bg-danger-50 text-danger-600 dark:bg-danger-950/50 dark:text-danger-300",
        )}
      >
        <Icon icon={icon} width={20} height={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cn(
            "font-medium leading-tight",
            tone === "danger" && "text-danger-600 dark:text-danger-300",
          )}
        >
          {title}
        </span>
        {description ? (
          <span
            className={cn(
              "whitespace-normal break-words text-sm leading-snug text-accent-700 dark:text-accent-200",
              tone === "danger" && "text-danger-700 dark:text-danger-300",
            )}
          >
            {description}
          </span>
        ) : null}
      </span>
      {onPress ? (
        <span
          className={cn(
            "ml-2 flex shrink-0 items-center gap-1 text-sm font-medium text-accent-700 dark:text-accent-100",
            tone === "danger" && "text-danger-600 dark:text-danger-300",
          )}
        >
          <Icon icon="lucide.chevron-right" width={18} height={18} />
        </span>
      ) : statusLabel ? (
        <span
          className={cn(
            "ml-2 shrink-0 rounded-full bg-accent-100 px-2.5 py-1 text-xs font-medium text-accent-700 dark:bg-accent-900 dark:text-accent-100",
            tone === "danger" &&
              "bg-danger-50 text-danger-700 dark:bg-danger-950/50 dark:text-danger-300",
          )}
        >
          {statusLabel}
        </span>
      ) : isConnected ? (
        <Icon
          className="text-accent-600 dark:text-accent-200"
          icon="lucide.check"
          width={18}
          height={18}
        />
      ) : null}
    </span>
  );
  const className = cn(
    "-mx-3 h-auto min-h-16 w-[calc(100%+1.5rem)] justify-start rounded-xl px-3 py-3 text-left",
    "hover:bg-accent-100/70 dark:hover:bg-accent-900/70",
    tone === "danger" && "hover:bg-danger-50 dark:hover:bg-danger-950/40",
  );

  if (onPress) {
    return (
      <Button
        color="transparent"
        className={className}
        isDisabled={isDisabled}
        onPress={onPress}
        type="button"
      >
        {content}
      </Button>
    );
  }

  return (
    <div className="-mx-3 flex min-h-16 w-[calc(100%+1.5rem)] items-center rounded-xl px-3 py-3 text-left">
      {content}
    </div>
  );
}
