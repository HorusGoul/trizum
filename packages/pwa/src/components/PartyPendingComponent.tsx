import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button as AriaButton, Disclosure, DisclosurePanel } from "react-aria-components";
import { TrizumSpinner } from "./TrizumSpinner.js";
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.tsx";
import { cn } from "#src/ui/utils.ts";

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
        <TrizumSpinner size={80} className="text-accent-600 dark:text-accent-400" />
      </div>

      {/* Main title */}
      <h2 className="text-accent-800 dark:text-accent-200 text-center text-xl font-semibold">
        <Trans>Syncing party information...</Trans>
      </h2>

      {/* Subtitle */}
      <p className="text-accent-600 dark:text-accent-400 mt-2 text-center text-sm">
        <Trans>Please wait while we fetch the latest data</Trans>
      </p>

      {/* Tips section - visible immediately */}
      <div className="mt-8 w-full max-w-sm">
        <div className="border-accent-200 from-accent-50 to-accent-100 dark:border-accent-800 dark:from-accent-900/80 dark:to-accent-900/40 relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5">
          <div className="text-accent-300 dark:text-accent-700 absolute top-3 right-3">
            <Icon icon="lucide.lightbulb" width={20} height={20} />
          </div>
          <span className="text-accent-500 dark:text-accent-400 mb-2 block text-xs font-semibold tracking-wider uppercase">
            <Trans>Did you know?</Trans>
          </span>
          <p
            className="text-accent-700 dark:text-accent-300 h-10 pr-6 text-sm leading-relaxed"
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
            <Button
              color="input-like"
              className="flex-1 rounded-xl font-medium"
              onPress={handleGoHome}
            >
              <Icon icon="lucide.arrow-left" width={18} height={18} className="mr-2" />
              <Trans>Go back</Trans>
            </Button>

            <Button color="accent" className="flex-1 rounded-xl font-medium" onPress={handleReload}>
              <Icon icon="lucide.refresh-cw" width={18} height={18} className="mr-2" />
              <Trans>Retry</Trans>
            </Button>
          </div>

          {/* Collapsible insights */}
          <Disclosure>
            {({ isExpanded }) => (
              <div className="border-accent-200 bg-accent-50 dark:border-accent-800 dark:bg-accent-900/50 rounded-xl border">
                <AriaButton
                  slot="trigger"
                  className="text-accent-600 dark:text-accent-400 flex w-full items-center justify-between gap-2 p-4 outline-hidden"
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
                  <div className="px-4 pb-4">
                    <ul className="space-y-2">
                      {troubleshootingReasons.map((reason) => (
                        <li
                          key={reason.id}
                          className="text-accent-600 dark:text-accent-400 flex items-start gap-2.5 text-sm"
                        >
                          <span className="bg-accent-400 dark:bg-accent-600 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
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
