import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Button as AriaButton,
  Disclosure,
  DisclosurePanel,
} from "react-aria-components";
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
  () => t`The party may have been deleted by another member.`,
  () => t`Your internet connection might be too slow.`,
  () => t`The party data hasn't synced to the sync server yet.`,
  () => t`The party link may be invalid or expired.`,
];

/**
 * Thresholds for different states:
 * - showTroubleshooting: 8 seconds (show troubleshooting info)
 */
const SHOW_TROUBLESHOOTING_DELAY = 10000;
const TIP_ROTATION_INTERVAL = 5000;

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

  function handleReload() {
    window.location.reload();
  }

  return (
    <div className="flex min-h-full flex-col items-center px-6 pt-safe-offset-24">
      {/* Animated Logo - swing rotation */}
      <div className="relative mb-8">
        <svg
          width="80"
          height="80"
          viewBox="0 0 512 512"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-accent-600 dark:text-accent-400"
          style={{
            animation: "swing-rotate 2s cubic-bezier(0.4, 0, 0.2, 1) infinite",
          }}
        >
          <path
            d="M138.738 197.734H356.862C356.862 197.734 397.947 197.734 397.947 166.36C397.947 134.986 356.862 134.986 356.862 134.986C335.199 134.986 311.295 134.986 301.584 161.878M273.945 232.843C273.945 232.843 238.089 317.254 199.245 357.592C185.578 371.785 174.594 377.014 154.425 377.014C134.256 377.014 113.388 366.556 114.087 344.893C114.786 323.23 138.738 323.23 138.738 323.23H176.835M273.945 323.23H356.862"
            stroke="currentColor"
            strokeWidth="17.928"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Main title */}
      <h2 className="text-center text-xl font-semibold text-accent-800 dark:text-accent-200">
        <Trans>Syncing party information...</Trans>
      </h2>

      {/* Subtitle */}
      <p className="mt-2 text-center text-sm text-accent-600 dark:text-accent-400">
        <Trans>Please wait while we fetch the latest data</Trans>
      </p>

      {/* Tips section - visible immediately */}
      <div className="mt-8 w-full max-w-sm">
        <div className="relative overflow-hidden rounded-2xl border border-accent-200 bg-gradient-to-br from-accent-50 to-accent-100 p-5 dark:border-accent-800 dark:from-accent-900/80 dark:to-accent-900/40">
          <div className="absolute right-3 top-3 text-accent-300 dark:text-accent-700">
            <Icon name="#lucide/lightbulb" size={20} />
          </div>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-accent-500 dark:text-accent-400">
            <Trans>Did you know?</Trans>
          </span>
          <p
            className="h-10 pr-6 text-sm leading-relaxed text-accent-700 dark:text-accent-300"
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
              <Icon name="#lucide/arrow-left" size={18} className="mr-2" />
              <Trans>Go back</Trans>
            </Button>

            <Button
              color="accent"
              className="flex-1 rounded-xl font-medium"
              onPress={handleReload}
            >
              <Icon name="#lucide/refresh-cw" size={18} className="mr-2" />
              <Trans>Retry</Trans>
            </Button>
          </div>

          {/* Collapsible insights */}
          <Disclosure>
            {({ isExpanded }) => (
              <div className="rounded-xl border border-accent-200 bg-accent-50 dark:border-accent-800 dark:bg-accent-900/50">
                <AriaButton
                  slot="trigger"
                  className="flex w-full items-center justify-between gap-2 p-4 text-accent-600 outline-none dark:text-accent-400"
                >
                  <div className="flex items-center gap-2">
                    <Icon name="#lucide/circle-help" size={18} />
                    <span className="font-medium">
                      <Trans>Why is this taking so long?</Trans>
                    </span>
                  </div>
                  <Icon
                    name="#lucide/chevron-down"
                    size={18}
                    className={cn(
                      "transition-transform duration-200",
                      isExpanded && "rotate-180",
                    )}
                  />
                </AriaButton>

                <DisclosurePanel className="overflow-hidden">
                  <div className="px-4 pb-4">
                    <ul className="space-y-2">
                      {troubleshootingReasons.map((reason, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2.5 text-sm text-accent-600 dark:text-accent-400"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-400 dark:bg-accent-600" />
                          <span>{reason()}</span>
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
