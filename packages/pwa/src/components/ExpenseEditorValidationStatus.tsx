import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m as motion,
  useReducedMotion,
} from "motion/react";
import { Dialog, DialogTrigger, Modal, ModalOverlay } from "react-aria-components";
import { CurrencyText } from "#src/components/CurrencyText.tsx";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import type {
  ExpenseEditorValidationIssue,
  ExpenseEditorValidationResult,
  ExpenseEditorValidationStatus,
} from "#src/lib/expenseEditor.ts";
import { Button } from "#src/ui/Button.tsx";
import { Icon, type IconProps } from "#src/ui/Icon.tsx";
import { cn } from "#src/ui/utils.ts";

interface ExpenseEditorValidationStatusProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  validation: ExpenseEditorValidationResult;
}

interface StatusAppearance {
  className: string;
  icon: IconProps["icon"];
}

const statusAppearances: Record<ExpenseEditorValidationStatus, StatusAppearance> = {
  pristine: {
    className:
      "border-accent-400 bg-accent-50 text-accent-700 dark:border-accent-700 dark:bg-accent-900 dark:text-accent-200",
    icon: "lucide.badge-info",
  },
  incomplete: {
    className:
      "border-accent-400 bg-accent-50 text-accent-700 dark:border-accent-700 dark:bg-accent-900 dark:text-accent-200",
    icon: "lucide.badge-info",
  },
  valid: {
    className:
      "border-success-400 bg-success-50 text-success-700 dark:border-success-700 dark:bg-success-950/40 dark:text-success-200",
    icon: "lucide.circle-check",
  },
  warning: {
    className:
      "border-warning-500 bg-warning-50 text-warning-800 dark:border-warning-700 dark:bg-warning-950/40 dark:text-warning-200",
    icon: "lucide.triangle-alert",
  },
  error: {
    className:
      "border-danger-500 bg-danger-50 text-danger-700 dark:border-danger-700 dark:bg-danger-950/40 dark:text-danger-200",
    icon: "lucide.circle-alert",
  },
};

const statusBarClassName =
  "flex h-12 w-full items-center gap-3 rounded-lg border px-4 text-left text-sm font-medium";

export function ExpenseEditorValidationStatus({
  isOpen,
  onOpenChange,
  validation,
}: ExpenseEditorValidationStatusProps) {
  const appearance = statusAppearances[validation.status];
  const shouldReduceMotion = useReducedMotion();
  const content = (
    <>
      <Icon icon={appearance.icon} className="size-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        <ExpenseEditorStatusMessage
          issueCount={validation.issues.length}
          status={validation.status}
        />
      </span>
      {validation.issues.length > 0 ? (
        <Icon icon="lucide.chevron-right" className="size-5 shrink-0" />
      ) : null}
    </>
  );

  return (
    <div aria-live="polite" className="container px-4">
      <LazyMotion features={domAnimation}>
        <div className="relative h-12">
          <AnimatePresence initial={false}>
            <motion.div
              key={validation.status}
              animate={{ opacity: 1, transform: "translateY(0)" }}
              className="absolute inset-0"
              exit={{
                opacity: 0,
                transform: shouldReduceMotion ? "translateY(0)" : "translateY(-3px)",
              }}
              initial={{
                opacity: 0,
                transform: shouldReduceMotion ? "translateY(0)" : "translateY(3px)",
              }}
              transition={
                shouldReduceMotion
                  ? { duration: 0.1 }
                  : { duration: 0.18, ease: [0.23, 1, 0.32, 1] }
              }
            >
              {validation.issues.length === 0 ? (
                <output className={cn(statusBarClassName, appearance.className)}>{content}</output>
              ) : (
                <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
                  <Button
                    className={({ isFocusVisible, isHovered, isPressed }) =>
                      cn(
                        statusBarClassName,
                        appearance.className,
                        "justify-start rounded-lg",
                        !isOpen &&
                          (isHovered || isFocusVisible) &&
                          "brightness-95 dark:brightness-110",
                        !isOpen &&
                          isFocusVisible &&
                          "ring-2 ring-current ring-offset-2 ring-offset-white dark:ring-offset-accent-950",
                        !isOpen && isPressed && "brightness-90 dark:brightness-125",
                        isOpen && "scale-100 brightness-100 dark:brightness-100",
                      )
                    }
                    type="button"
                  >
                    {content}
                  </Button>
                  <ExpenseEditorValidationDialog issues={validation.issues} />
                </DialogTrigger>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </LazyMotion>
    </div>
  );
}

function ExpenseEditorStatusMessage({
  issueCount,
  status,
}: {
  issueCount: number;
  status: ExpenseEditorValidationStatus;
}) {
  switch (status) {
    case "pristine":
      return <Trans>Add expense details to get started</Trans>;
    case "incomplete":
      return <Trans>Complete the required details</Trans>;
    case "valid":
      return <Trans>All expense checks passed</Trans>;
    case "warning":
      return <Plural value={issueCount} one="# warning" other="# warnings" />;
    case "error":
      return (
        <Plural
          value={issueCount}
          one="# issue must be resolved"
          other="# issues must be resolved"
        />
      );
  }
}

function ExpenseEditorValidationDialog({ issues }: { issues: ExpenseEditorValidationIssue[] }) {
  return (
    <ModalOverlay
      isDismissable
      className={({ isEntering, isExiting }) =>
        cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-accent-950/45 px-safe-or-4 py-safe-offset-6 backdrop-blur-md",
          isEntering && "duration-200 ease-out animate-in fade-in",
          isExiting && "duration-150 ease-in animate-out fade-out",
        )
      }
    >
      <Modal
        className={({ isEntering, isExiting }) =>
          cn(
            "max-h-[calc(var(--visual-viewport-height)*0.9)] w-full max-w-[420px] outline-hidden",
            isEntering && "duration-200 ease-out animate-in fade-in zoom-in-95",
            isExiting && "duration-150 ease-in animate-out fade-out zoom-out-95",
          )
        }
      >
        <Dialog
          aria-label={t`Expense checks`}
          className="border-accent-200 dark:border-accent-800 dark:bg-accent-950 max-h-[inherit] overflow-y-auto rounded-lg border bg-white shadow-2xl outline-hidden"
        >
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="text-danger-600 dark:text-danger-300 flex size-9 shrink-0 items-center justify-center">
                <Icon icon="lucide.circle-alert" className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-medium">
                  <Trans>Expense checks</Trans>
                </h2>
                <p className="text-accent-700 dark:text-accent-200 mt-1 text-sm">
                  <Plural
                    value={issues.length}
                    one="# issue must be resolved before saving."
                    other="# issues must be resolved before saving."
                  />
                </p>
              </div>
            </div>

            <ul className="divide-accent-200 dark:divide-accent-800 flex flex-col divide-y">
              {issues.map((issue) => (
                <ExpenseEditorValidationIssueItem issue={issue} key={issue.code} />
              ))}
            </ul>

            <Button className="font-semibold" color="accent" slot="close" type="button">
              <Trans>Review expense</Trans>
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function ExpenseEditorValidationIssueItem({ issue }: { issue: ExpenseEditorValidationIssue }) {
  const { party } = useCurrentParty();

  switch (issue.code) {
    case "shares-total-mismatch":
      return (
        <li className="flex gap-3 py-4 first:pt-0 last:pb-0">
          <Icon
            icon="lucide.circle-alert"
            className="text-danger-600 dark:text-danger-300 mt-0.5 size-5 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium">
              <Trans>Split total does not match</Trans>
            </h3>
            <p className="text-accent-700 dark:text-accent-200 mt-1 text-sm">
              <Trans>
                Shares sum up to{" "}
                <CurrencyText
                  amount={issue.sharesTotal}
                  currency={party.currency}
                  className="font-semibold"
                  variant="inherit"
                />
                , while the expense amount is{" "}
                <CurrencyText
                  amount={issue.expenseAmount}
                  currency={party.currency}
                  className="font-semibold"
                  variant="inherit"
                />
                .
              </Trans>
            </p>
          </div>
        </li>
      );
  }
}
