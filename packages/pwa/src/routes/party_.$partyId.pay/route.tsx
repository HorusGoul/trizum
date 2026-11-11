import { PartyTransferView } from "#src/lib/data/views.ts";
import { z } from "zod";
import { trackEvent } from "#src/lib/analytics.ts";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { BackButton } from "#src/components/BackButton.tsx";
import { CurrencyText } from "#src/components/CurrencyText.tsx";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.ts";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import { Button } from "@trizum/ui/Button";
import { Icon } from "@trizum/ui/Icon";
import { Alert, AlertDescription } from "@trizum/ui/Alert";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";
import { toast } from "sonner";
import { PaymentMethodItem } from "./-components/PaymentMethodItem.tsx";
import { getPaymentMethods } from "#src/lib/paymentMethods.ts";
import { paymentMethodTypes } from "#src/models/paymentMethod.ts";
import { CashItem } from "./-components/CashItem.js";

interface PaySearchParams {
  fromId: string;
  toId: string;
  amount: number;
}

export const Route = createFileRoute("/party_/$partyId/pay")({
  component: RouteComponent,
  pendingComponent: PartyPendingComponent,
  validateSearch: (search): PaySearchParams => {
    const result = z
      .object({
        fromId: z.string().min(1),
        toId: z.string().min(1),
        amount: z.number().refine((amount) => amount !== 0),
      })
      .safeParse(search);

    if (!result.success) throw new Error(t`Missing search params`);

    return result.data;
  },
});

function RouteComponent() {
  const { fromId, toId, amount } = Route.useSearch();
  const { party, addExpenseToParty } = useCurrentParty(PartyTransferView);
  const me = useCurrentParticipant();
  const from = party.participants[fromId];
  const to = party.participants[toId];
  const isFromMe = fromId === me.id;
  const navigate = useNavigate();
  const fromName = from.name;
  const toName = to.name;

  const methods = getPaymentMethods(to);
  const hasPaymentDetails = paymentMethodTypes.some((type) => methods[type]?.trim());

  function onMarkAsPaid() {
    const expensePromise = addExpenseToParty({
      name: t({ message: `Paid debt to ${toName}` }),
      paidAt: new Date(),
      paidBy: { [fromId]: amount },
      isTransfer: true,
      shares: { [toId]: { type: "divide", value: 1 } },
      photos: [],
    });

    toast.promise(expensePromise, {
      loading: t`Marking expense as paid...`,
      success: t({ message: `Debt settled between ${fromName} and ${toName}!` }),
      error: t`Failed to mark expense as paid`,
    });

    void expensePromise.then((expense) => {
      trackEvent("settlement_recorded");

      return navigate({
        to: "/party/$partyId/expense/$expenseId",
        params: {
          partyId: party.id,
          expenseId: expense.id,
        },
        replace: true,
      });
    });
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="mt-safe container flex h-16 items-center px-2">
        <BackButton fallbackOptions={{ to: "/party/$partyId" }} />
        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          {isFromMe ? <Trans>Pay</Trans> : <Trans>Mark as paid</Trans>}
        </h1>
      </div>

      <div className="container flex flex-col gap-4 px-4 pt-4">
        <div className="dark:bg-accent-900 flex rounded-xl bg-white p-4">
          <div className="flex flex-1 flex-col">
            <span className="text-accent-400 text-lg">
              {from.name} {fromId === me.id ? t`(me)` : ""}
            </span>
            <span className="text-accent-700 dark:text-accent-300 text-sm">
              <Trans>owes</Trans>
            </span>
            <span className="text-accent-400 text-lg">
              {to.name} {toId === me.id ? t`(me)` : ""}
            </span>
          </div>

          <div className="flex shrink-0 items-center">
            <CurrencyText currency={party.currency} amount={Math.abs(amount)} className="text-xl" />
          </div>
        </div>

        <Button color="accent" className="min-h-12 font-semibold" onPress={onMarkAsPaid}>
          <Icon icon="lucide.circle-check" width={20} height={20} className="mr-2" />
          <Trans>Mark as paid</Trans>
        </Button>

        <h2 className="mt-2 text-xl font-semibold">
          <Trans>How to pay?</Trans>
        </h2>

        <p className="text-lg">
          <Trans>Send the money using one of the methods below, then mark this debt as paid.</Trans>
        </p>

        {hasPaymentDetails ? (
          <Alert variant="info" role="note" className="py-2">
            <Icon icon="lucide.info" />
            <AlertDescription>
              <Trans>Hold to copy payment details.</Trans>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="divide-accent-100 dark:divide-accent-800 divide-y rounded-xl">
          {paymentMethodTypes.map((type) => {
            const details = methods[type];

            return details?.trim() ? (
              <PaymentMethodItem key={type} type={type} details={details} />
            ) : null;
          })}
          <CashItem />
        </div>
      </div>

      <div className="h-16 shrink-0" />
    </div>
  );
}
