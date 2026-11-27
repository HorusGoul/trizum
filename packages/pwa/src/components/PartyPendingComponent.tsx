import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button as AriaButton, Disclosure, DisclosurePanel } from "react-aria-components";
import { TrizumSpinner } from "@trizum/ui/TrizumSpinner";
import { Button } from "@trizum/ui/Button";
import { Icon } from "@trizum/ui/Icon";
import { cn } from "@trizum/ui/utils";

const tips = [
  () => t`You can add photos to your expenses for better tracking.`,
  () => t`Use personal mode to filter only your expenses.`,
  () => t`Share the party link so others can join.`,
  () => t`Archive participants who left to keep balances clean.`,
  () => t`The app works offline too!`,
  () => t`Swipe between expenses and balances tabs.`,
];

const troubleshootingReasons = [
  {
    id: "party-deleted",
    label: () => t`The party may have been deleted by another member.`,
  },
  {
    id: "slow-connection",
    label: () => t`Your internet connection might be too slow.`,
  },
  {
    id: "sync-pending",
    label: () => t`The party data hasn't synced to the sync server yet.`,
  },
  {
    id: "invalid-link",
    label: () => t`The party link may be invalid or expired.`,
  },
];

/**
 * Thresholds for different states:
 * - showTroubleshooting: 10 seconds (show troubleshooting info)
 */
const SHOW_TROUBLESHOOTING_DELAY = 10000;
const TIP_ROTATION_INTERVAL = 5000;

function handleReload() {
  window.location.reload();
}

export function PartyPendingComponent() {
  const navigate = useNavigate();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  // Track elapsed time
  useEffect(() => {
    const startTime = Date.now();

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Rotate tips immediately
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % tips.length);
    }, TIP_ROTATION_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  const showTroubleshooting = elapsedTime >= SHOW_TROUBLESHOOTING_DELAY;

  function handleGoHome() {
    void navigate({ to: "/", replace: true });
  }

  return (
    <div className="pt-safe-offset-24 flex min-h-full flex-col items-center px-6">
      {/* Animated Logo - swing rotation */}
      <div className="relative mb-8">
        <TrizumSpinner size={80} className="text-accent-500 dark:text-accent-400" />
      </div>

      {/* Main title */}
      <h2 className="text-center text-xl font-semibold text-neutral-950 dark:text-neutral-50">
        <Trans>Syncing party information...</Trans>
      </h2>

      {/* Subtitle */}
      <p className="mt-2 text-center text-sm text-neutral-600 dark:text-neutral-400">
        <Trans>Please wait while we fetch the latest data</Trans>
      </p>

      {/* Tips section - visible immediately */}
      <div className="mt-8 w-full max-w-sm">
        <div className="shadow-surface relative overflow-hidden rounded-3xl bg-white p-5 dark:bg-neutral-900">
          <div className="absolute top-4 right-4 text-neutral-300 dark:text-neutral-600">
            <Icon icon="lucide.lightbulb" width={20} height={20} />
          </div>
          <span className="mb-2 block text-xs font-semibold tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
            <Trans>Did you know?</Trans>
          </span>
          <p
            className="h-10 pr-6 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400"
            key={currentTipIndex}
            style={{
              animation: "fade-in-up 0.4s ease-out",
            }}
          >
            {tips[currentTipIndex]()}
          </p>
        </div>
      </div>

      {/* Troubleshooting section - appears after longer delay */}
      <div
        className="mt-8 w-full max-w-sm transition-all duration-700"
        style={{
          opacity: showTroubleshooting ? 1 : 0,
          transform: showTroubleshooting ? "translateY(0)" : "translateY(20px)",
          pointerEvents: showTroubleshooting ? "auto" : "none",
        }}
      >
        <div className="flex flex-col gap-4">
          {/* Action buttons - now above insights */}
          <div className="flex gap-3">
            <Button color="neutral" className="flex-1 font-medium" onPress={handleGoHome}>
              <Icon icon="lucide.arrow-left" width={18} height={18} className="mr-2" />
              <Trans>Go back</Trans>
            </Button>

            <Button color="accent" className="flex-1 font-medium" onPress={handleReload}>
              <Icon icon="lucide.refresh-cw" width={18} height={18} className="mr-2" />
              <Trans>Retry</Trans>
            </Button>
          </div>

          {/* Collapsible insights */}
          <Disclosure>
            {({ isExpanded }) => (
              <div className="shadow-surface rounded-3xl bg-white dark:bg-neutral-900">
                <AriaButton
                  slot="trigger"
                  className="data-[focus-visible]:ring-accent-500 dark:data-[focus-visible]:ring-accent-400 flex w-full items-center justify-between gap-2 rounded-3xl px-5 py-4 text-neutral-600 outline-hidden data-[focus-visible]:ring-2 dark:text-neutral-400"
                >
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide.circle-help" width={18} height={18} />
                    <span className="font-medium">
                      <Trans>Why is this taking so long?</Trans>
                    </span>
                  </div>
                  <Icon
                    icon="lucide.chevron-down"
                    width={18}
                    height={18}
                    className={cn("transition-transform duration-200", isExpanded && "rotate-180")}
                  />
                </AriaButton>

                <DisclosurePanel className="overflow-hidden">
                  <div className="px-5 pb-5">
                    <ul className="space-y-2">
                      {troubleshootingReasons.map((reason) => (
                        <li
                          key={reason.id}
                          className="flex items-start gap-2.5 text-sm text-neutral-600 dark:text-neutral-400"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400 dark:bg-neutral-600" />
                          <span>{reason.label()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </DisclosurePanel>
              </div>
            )}
          </Disclosure>
        </div>
      </div>
    </div>
  );
}
