import { Trans } from "@lingui/react/macro";
import { m } from "motion/react";
import { Icon } from "#src/ui/Icon.tsx";

export function TransferSuccessState({
  destinationPartyName,
  destinationCounterpartyName,
  destinationDebtorName,
}: {
  destinationPartyName: string;
  destinationCounterpartyName: string;
  destinationDebtorName: string;
}) {
  return (
    <div className="container flex flex-1 flex-col items-center justify-center px-6 text-center pt-safe-offset-24">
      <div className="relative">
        <m.div
          className="absolute inset-0 rounded-full bg-success-500/20"
          animate={{ scale: [1, 1.35, 1], opacity: [0.25, 0.05, 0.25] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />

        <m.div
          className="relative flex h-24 w-24 items-center justify-center rounded-full bg-success-500 text-success-50 shadow-lg dark:shadow-none"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 18 }}
        >
          <m.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.12, type: "spring", stiffness: 320 }}
          >
            <Icon icon="lucide.check" width={40} height={40} />
          </m.div>
        </m.div>
      </div>

      <h2 className="mt-8 text-3xl font-semibold tracking-tight">
        <Trans>Debt transferred</Trans>
      </h2>

      <p className="mt-3 max-w-sm text-sm leading-6 text-accent-800 dark:text-accent-200">
        <Trans>
          The new debt is now in <span className="font-semibold">{destinationPartyName}</span>,
          where <span className="font-semibold">{destinationCounterpartyName}</span> is owed by{" "}
          <span className="font-semibold">{destinationDebtorName}</span>.
        </Trans>
      </p>
    </div>
  );
}
