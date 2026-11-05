import { App } from "@modelcontextprotocol/ext-apps";
import { useState, useTransition } from "react";
import { createRoot } from "react-dom/client";
import { z } from "zod";
import { partyViewSchema, type PartyView } from "./contracts.js";

const app = new App({ name: "trizum", version: "0.1.0" });
const root = createRoot(document.getElementById("root")!);

const labelsSchema = z.object({
  locale: z.string(),
  openLabel: z.string(),
  expensesLabel: z.string(),
  balancesLabel: z.string(),
  openErrorLabel: z.string(),
});

export function PartyCard({
  party,
  labels,
}: {
  party: PartyView;
  labels: z.infer<typeof labelsSchema>;
}) {
  const [isPending, startTransition] = useTransition();
  const [openFailed, setOpenFailed] = useState(false);
  const url = new URL(party.url);

  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1")
    return null;

  const format = (amount: string) =>
    new Intl.NumberFormat(labels.locale, {
      style: "currency",
      currency: party.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount));

  return (
    <main>
      <h1>
        {party.symbol} {party.name}
      </h1>
      {party.description && <p>{party.description}</p>}
      <h2>{labels.balancesLabel}</h2>
      <ul>
        {party.participants.map((person) => (
          <li key={person.id}>
            <span>{person.name}</span>
            <span>{format(person.balance)}</span>
          </li>
        ))}
      </ul>
      <h2>{labels.expensesLabel}</h2>
      <ul>
        {party.expenses.map((expense) => (
          <li key={expense.id}>
            <span>{expense.name}</span>
            <span>{format(expense.amount)}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setOpenFailed(false);

            try {
              const result = await app.openLink({ url: url.href }, { timeout: 5000 });
              setOpenFailed(result.isError === true);
            } catch {
              setOpenFailed(true);
            }
          })
        }
      >
        {labels.openLabel}
      </button>
      {openFailed && (
        <p role="alert">
          {labels.openErrorLabel} <code>{url.href}</code>
        </p>
      )}
    </main>
  );
}

app.ontoolresult = (result) => {
  if (result.isError) {
    const error = z.object({ errorLabel: z.string() }).safeParse(result._meta);

    if (error.success) root.render(<p role="alert">{error.data.errorLabel}</p>);

    return;
  }

  const party = partyViewSchema.safeParse(result.structuredContent);
  const labels = labelsSchema.safeParse(result._meta);

  if (party.success && labels.success)
    root.render(<PartyCard key={party.data.partyId} party={party.data} labels={labels.data} />);
};

void app.connect();
