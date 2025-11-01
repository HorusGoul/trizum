import { BackButton } from "#src/components/BackButton.tsx";
import { CurrencyText } from "#src/components/CurrencyText.tsx";
import { useCurrentParticipant } from "#src/hooks/useCurrentParticipant.ts";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.tsx";
import { t, Trans } from "@lingui/macro";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

interface PaySearchParams {
  fromId: string;
  toId: string;
  amount: number;
}

export const Route = createFileRoute("/party_/$partyId/pay")({
  component: RouteComponent,
  validateSearch: (search): PaySearchParams => {
    if (!search.fromId || !search.toId || !search.amount) {
      throw new Error(t`Missing search params`);
    }

    return {
      fromId: search.fromId as string,
      toId: search.toId as string,
      amount: search.amount as number,
    };
  },
});

type PaymentMethod =
  | {
      type: "bizum";
      phoneNumber: string;
    }
  | {
      type: "cash";
    };

function RouteComponent() {
  const { fromId, toId, amount } = Route.useSearch();
  const { party, addExpenseToParty } = useCurrentParty();
  const me = useCurrentParticipant();
  const from = party.participants[fromId];
  const to = party.participants[toId];
  const isFromMe = fromId === me.id;
  const navigate = useNavigate();

  const methods: PaymentMethod[] = [
    to.phone ? { type: "bizum", phoneNumber: to.phone } : null,
    { type: "cash" },
  ].filter((method): method is PaymentMethod => !!method);

  function onMarkAsPaid() {
    const expensePromise = addExpenseToParty({
      name: t`Paid debt to ${to.name}`,
      paidAt: new Date(),
      paidBy: { [fromId]: amount },
      isTransfer: true,
      shares: { [toId]: { type: "divide", value: 1 } },
      photos: [],
    });

    toast.promise(expensePromise, {
      loading: t`Marking expense as paid...`,
      success: t`Debt settled between ${from.name} and ${to.name}!`,
      error: t`Failed to mark expense as paid`,
    });

    expensePromise.then((expense) => {
      navigate({
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
      <div className="container flex h-16 items-center px-2">
        <BackButton fallbackOptions={{ to: "/party/$partyId" }} />
        <h1 className="pl-4 text-2xl font-bold">
          {isFromMe ? <Trans>Pay</Trans> : <Trans>Mark as paid</Trans>}
        </h1>
      </div>

      <div className="container flex flex-col gap-4 px-4 pt-4">
        <div className="flex rounded-xl bg-white p-4 dark:bg-accent-900">
          <div className="flex flex-1 flex-col">
            <span className="text-lg text-accent-400">
              {from.name} {fromId === me.id ? t`(me)` : ""}
            </span>
            <span className="text-sm text-accent-700 dark:text-accent-300">
              <Trans>owes</Trans>
            </span>
            <span className="text-lg text-accent-400">
              {to.name} {toId === me.id ? t`(me)` : ""}
            </span>
          </div>

          <div className="flex flex-shrink-0 items-center">
            <CurrencyText
              currency={party.currency}
              amount={Math.abs(amount)}
              className="text-xl"
            />
          </div>
        </div>

        <Button color="accent" className="font-semibold" onPress={onMarkAsPaid}>
          <Icon name="#lucide/circle-check" size={20} className="mr-2" />
          <Trans>Mark as paid</Trans>
        </Button>

        <h2 className="mt-2 text-xl font-semibold">
          <Trans>How to pay?</Trans>
        </h2>

        <p className="text-lg">
          <Trans>
            Here's a list of ways you can pay, once done, press the button above
            to mark the expense as paid in this trizum party.
          </Trans>
        </p>

        {methods.map((method) => {
          let element;

          switch (method.type) {
            case "bizum":
              element = <BizumItem phoneNumber={method.phoneNumber} />;
              break;
            case "cash":
              element = <CashItem />;
              break;
          }

          return <div key={method.type}>{element}</div>;
        })}
      </div>

      <div className="h-16 flex-shrink-0" />
    </div>
  );
}

function BizumItem({ phoneNumber }: { phoneNumber: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white p-4 dark:bg-accent-900">
      <h3 className="text-lg font-semibold">Bizum</h3>
      <p className="text-accent-700 dark:text-accent-300">
        <Trans>
          Copy the phone number and pay through Bizum using your bank app.
        </Trans>
      </p>
      <Button
        color="input-like"
        className="rounded-lg font-semibold"
        onPress={async () => {
          try {
            // Attempt copy to clipboard
            await navigator.clipboard.writeText(phoneNumber);

            toast.success(t`Phone number copied to clipboard!`);
          } catch {
            prompt(
              t`Failed to copy phone number to clipboard, please copy it manually`,
              phoneNumber,
            );
          }
        }}
      >
        <Icon name="#lucide/copy" size={20} />
        <span className="ml-2">{phoneNumber}</span>
      </Button>
    </div>
  );
}

function CashItem() {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white p-4 dark:bg-accent-900">
      <h3 className="text-lg font-semibold">
        <Trans>Cash or other ways</Trans>
      </h3>
      <p className="text-accent-700 dark:text-accent-300">
        <Trans>
          Get in touch with the person to make the payment in cash or a
          different way outside of the ones described above.
        </Trans>
      </p>
    </div>
  );
}
