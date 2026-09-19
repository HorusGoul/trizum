import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useEffect, useState } from "react";
import { Dialog, Modal, ModalOverlay, Radio, RadioGroup } from "react-aria-components";
import { toast } from "sonner";
import {
  loadPremiumOffering,
  type PremiumEntitlementState,
  type PremiumOffering,
  type PremiumPlan,
  type PremiumPlanId,
  purchasePremiumPlan,
  restorePremiumPurchases,
} from "#src/lib/premium/premiumCommerce.ts";
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.tsx";
import { IconButton } from "#src/ui/IconButton.tsx";
import { cn } from "#src/ui/utils.ts";

interface PremiumPaywallProps {
  isOpen: boolean;
  onEntitlementChange: (entitlement: PremiumEntitlementState) => void;
  onOpenChange: (isOpen: boolean) => void;
  userId: string | null;
}

type LoadState =
  | { status: "loading" }
  | { offering: PremiumOffering; status: "ready" }
  | { status: "error" };

export function PremiumPaywall({
  isOpen,
  onEntitlementChange,
  onOpenChange,
  userId,
}: PremiumPaywallProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [selectedPlanId, setSelectedPlanId] = useState<PremiumPlanId | null>(null);
  const [activeAction, setActiveAction] = useState<"purchase" | "restore" | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let active = true;

    void loadPremiumOffering(userId)
      .then((offering) => {
        if (!active) {
          return;
        }

        setLoadState({ offering, status: "ready" });
        setSelectedPlanId(offering.defaultPlanId);
      })
      .catch(() => {
        if (active) {
          setLoadState({ status: "error" });
        }
      });

    return () => {
      active = false;
    };
  }, [isOpen, loadAttempt, userId]);

  const selectedPlan =
    loadState.status === "ready"
      ? loadState.offering.plans.find(({ id }) => id === selectedPlanId)
      : undefined;

  async function purchase() {
    if (!selectedPlanId) {
      return;
    }

    setActiveAction("purchase");
    try {
      const result = await purchasePremiumPlan(userId, selectedPlanId);
      if (result.status !== "cancelled") {
        onEntitlementChange(result.entitlement);
        if (result.entitlement.isPremium) {
          toast.success(t`Premium is now active.`);
          onOpenChange(false);
        } else {
          toast.error(t`Your purchase is still syncing. Try restoring it in a moment.`);
        }
      }
    } catch {
      toast.error(t`Premium could not be purchased. Please try again.`);
    }
    setActiveAction(null);
  }

  async function restore() {
    setActiveAction("restore");
    try {
      const entitlement = await restorePremiumPurchases(userId);
      onEntitlementChange(entitlement);

      if (entitlement.isPremium) {
        toast.success(t`Premium purchases restored.`);
        onOpenChange(false);
      } else {
        toast.error(t`No Premium purchase was found for this account.`);
      }
    } catch {
      toast.error(t`Purchases could not be restored. Please try again.`);
    }
    setActiveAction(null);
  }

  function retryLoading() {
    setLoadState({ status: "loading" });
    setLoadAttempt((attempt) => attempt + 1);
  }

  return (
    <ModalOverlay
      isDismissable={activeAction === null}
      isKeyboardDismissDisabled={activeAction !== null}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && activeAction === null) {
          onOpenChange(false);
        }
      }}
      className={({ isEntering, isExiting }) =>
        cn(
          "fixed inset-0 z-50 flex items-stretch justify-center bg-accent-950/55 backdrop-blur-md sm:items-center sm:px-safe-or-4 sm:py-safe-offset-6 motion-reduce:animate-none",
          isEntering && "duration-200 ease-out animate-in fade-in",
          isExiting && "duration-150 ease-out animate-out fade-out",
        )
      }
    >
      <Modal
        className={({ isEntering, isExiting }) =>
          cn(
            "h-full w-full outline-hidden sm:h-auto sm:max-w-[440px] motion-reduce:animate-none",
            isEntering && "duration-200 ease-out animate-in fade-in zoom-in-95",
            isExiting && "duration-150 ease-out animate-out fade-out zoom-out-95",
          )
        }
      >
        <Dialog
          aria-label={t`trizum Premium`}
          className="text-accent-950 sm:border-accent-200 dark:bg-accent-950 dark:text-accent-50 dark:sm:border-accent-800 relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-white shadow-2xl outline-hidden sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-[1.75rem] sm:border"
        >
          <IconButton
            aria-label={t`Close Premium`}
            className="right-safe-offset-3 top-safe-offset-3 text-accent-700 dark:text-accent-200 absolute z-10 sm:top-3 sm:right-3"
            icon="lucide.x"
            iconClassName="size-5"
            isDisabled={activeAction !== null}
            onPress={() => onOpenChange(false)}
          />

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="px-safe-or-5 pb-safe-offset-6 pt-safe-offset-5 flex flex-col sm:p-7">
              <header className="flex min-h-10 items-center pr-12">
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none font-bold tracking-tight" translate="no">
                    trizum
                  </span>
                  <span className="bg-accent-100 text-accent-700 dark:bg-accent-800 dark:text-accent-200 rounded-full px-2.5 py-1 text-xs leading-none font-semibold">
                    <Trans>Premium</Trans>
                  </span>
                </div>
              </header>

              <div className="mt-6 flex flex-col gap-6">
                <div className="flex flex-col gap-3">
                  <h2 className="max-w-xs text-2xl leading-[1.12] font-bold tracking-[-0.03em] text-balance sm:text-3xl">
                    <Trans>Premium, made for sharing.</Trans>
                  </h2>

                  <ul className="mt-1 flex flex-col gap-2.5 text-[0.9375rem] font-medium">
                    <PremiumBenefit>
                      <Trans>Ad-free for you</Trans>
                    </PremiumBenefit>
                    <PremiumBenefit>
                      <Trans>One Party Boost</Trans>
                    </PremiumBenefit>
                  </ul>
                </div>

                <div className="flex flex-col gap-3.5">
                  {loadState.status === "loading" ? <PremiumPlansSkeleton /> : null}

                  {loadState.status === "error" ? (
                    <div className="border-accent-200 bg-accent-50 dark:border-accent-800 dark:bg-accent-900 flex min-h-40 flex-col items-center justify-center gap-4 rounded-3xl border p-5 text-center">
                      <div className="flex flex-col gap-1.5">
                        <p className="font-semibold">
                          <Trans>Premium options are unavailable</Trans>
                        </p>
                        <p className="text-accent-700 dark:text-accent-300 text-sm">
                          <Trans>Check your connection and try again.</Trans>
                        </p>
                      </div>
                      <Button
                        className="max-w-40 font-semibold"
                        color="input-like"
                        onPress={retryLoading}
                      >
                        <Trans>Try again</Trans>
                      </Button>
                    </div>
                  ) : null}

                  {loadState.status === "ready" ? (
                    <RadioGroup
                      aria-label={t`Premium plan`}
                      className="flex flex-col gap-2"
                      isDisabled={activeAction !== null}
                      onChange={(value) => setSelectedPlanId(value as PremiumPlanId)}
                      orientation="vertical"
                      value={selectedPlanId}
                    >
                      {loadState.offering.plans.map((plan) => (
                        <PremiumPlanOption key={plan.id} plan={plan} />
                      ))}
                    </RadioGroup>
                  ) : null}

                  <div className="flex flex-col gap-1.5">
                    <Button
                      className="h-12 text-base font-bold"
                      color="accent"
                      isDisabled={!selectedPlan || activeAction !== null}
                      isPending={activeAction === "purchase"}
                      pressAction={purchase}
                      type="button"
                    >
                      {selectedPlan?.trial ? (
                        <Trans>Start free trial</Trans>
                      ) : (
                        <Trans>Continue with Premium</Trans>
                      )}
                    </Button>

                    <Button
                      className="text-accent-600 dark:text-accent-300 mx-auto h-9 w-auto px-4 text-sm font-semibold"
                      isDisabled={activeAction !== null || loadState.status !== "ready"}
                      isPending={activeAction === "restore"}
                      pressAction={restore}
                      type="button"
                    >
                      <Trans>Restore purchases</Trans>
                    </Button>
                  </div>
                </div>
              </div>

              <footer className="text-accent-500 dark:text-accent-400 mt-5 flex flex-col gap-2 text-center text-xs leading-relaxed">
                <PremiumRenewalDisclosure plan={selectedPlan} />
                <p>
                  <a
                    className="decoration-accent-400 underline underline-offset-2"
                    href="/terms"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Trans>Terms</Trans>
                  </a>
                  <span aria-hidden="true"> · </span>
                  <a
                    className="decoration-accent-400 underline underline-offset-2"
                    href="/privacy-policy"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Trans>Privacy Policy</Trans>
                  </a>
                </p>
              </footer>
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function PremiumBenefit({ children }: { children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1.125rem_minmax(0,1fr)] items-start gap-2.5">
      <Icon icon="lucide.check" className="text-accent-500 dark:text-accent-400 mt-0.5 size-4.5" />
      <span className="leading-5">{children}</span>
    </li>
  );
}

function PremiumPlanOption({ plan }: { plan: PremiumPlan }) {
  return (
    <Radio
      value={plan.id}
      className={({ isFocusVisible, isHovered, isPressed, isSelected }) =>
        cn(
          "relative grid min-h-18 cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-2xl border-2 px-4 py-3 text-left outline-hidden transition-[scale,background-color,border-color,color] duration-200 ease-in-out motion-reduce:transition-none",
          isSelected
            ? "border-accent-500 bg-accent-100 text-accent-950 dark:border-accent-400 dark:bg-accent-800 dark:text-accent-50"
            : "border-accent-200 bg-accent-50 text-accent-900 dark:border-accent-800 dark:bg-accent-900 dark:text-accent-100",
          isHovered && !isSelected && "border-accent-400 dark:border-accent-600",
          isFocusVisible &&
            "ring-2 ring-accent-500 ring-offset-2 ring-offset-white dark:ring-offset-accent-950",
          isPressed && "scale-[0.985]",
        )
      }
    >
      {({ isSelected }) => (
        <>
          <span
            aria-hidden="true"
            className={cn(
              "flex size-5 items-center justify-center rounded-full border transition-[background-color,border-color,color] duration-200 ease-in-out motion-reduce:transition-none",
              isSelected
                ? "border-accent-500 bg-accent-500 text-white"
                : "border-accent-300 dark:border-accent-700",
            )}
          >
            <Icon
              icon="lucide.check"
              className={cn(
                "size-3 transition-[scale,opacity] duration-200 ease-in-out motion-reduce:transition-none",
                isSelected ? "scale-100 opacity-100" : "scale-75 opacity-0",
              )}
            />
          </span>

          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm leading-5 font-bold">
              <PremiumPlanName planId={plan.id} />
            </span>
            <span className="text-accent-600 dark:text-accent-300 text-xs leading-4 tabular-nums">
              <PremiumPlanCadence plan={plan} />
            </span>
          </span>
          <span className="text-base leading-5 font-bold whitespace-nowrap tabular-nums">
            {plan.price}
          </span>
        </>
      )}
    </Radio>
  );
}

function PremiumPlanName({ planId }: { planId: PremiumPlanId }) {
  switch (planId) {
    case "monthly":
      return <Trans>Monthly</Trans>;
    case "annual":
      return <Trans>Annual</Trans>;
    case "lifetime":
      return <Trans>Lifetime</Trans>;
  }
}

function PremiumPlanCadence({ plan }: { plan: PremiumPlan }) {
  if (plan.trial) {
    return <PremiumTrialLabel trial={plan.trial} />;
  }

  if (plan.id === "monthly") {
    return <Trans>per month</Trans>;
  }

  if (plan.id === "annual") {
    const pricePerMonth = plan.pricePerMonth;
    return pricePerMonth ? <Trans>{pricePerMonth} per month</Trans> : <Trans>per year</Trans>;
  }

  return <Trans>one-time</Trans>;
}

function PremiumTrialLabel({ trial }: { trial: NonNullable<PremiumPlan["trial"]> }) {
  switch (trial.unit) {
    case "day":
      return <Plural value={trial.duration} one="# day free" other="# days free" />;
    case "week":
      return <Plural value={trial.duration} one="# week free" other="# weeks free" />;
    case "month":
      return <Plural value={trial.duration} one="# month free" other="# months free" />;
    case "year":
      return <Plural value={trial.duration} one="# year free" other="# years free" />;
  }
}

function PremiumRenewalDisclosure({ plan }: { plan: PremiumPlan | undefined }) {
  if (!plan) {
    return null;
  }

  const price = plan.price;

  if (plan.id === "lifetime") {
    return (
      <p>
        <Trans>One payment. No recurring charge.</Trans>
      </p>
    );
  }

  if (plan.trial) {
    return (
      <p>
        <Trans>After the free trial, {price} is charged automatically until canceled.</Trans>
      </p>
    );
  }

  return (
    <p>
      <Trans>{price} is charged automatically until canceled.</Trans>
    </p>
  );
}

function PremiumPlansSkeleton() {
  return (
    <div aria-label={t`Loading Premium options`} className="flex flex-col gap-2">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="border-accent-200 bg-accent-50 dark:border-accent-800 dark:bg-accent-900 min-h-18 animate-pulse rounded-2xl border-2 motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}
