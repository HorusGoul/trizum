import { App } from "@modelcontextprotocol/ext-apps";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { setupI18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { messages as en } from "@trizum/ui/locales/en";
import { messages as es } from "@trizum/ui/locales/es";
import { UIProvider } from "@trizum/ui/UIProvider";
import { Button } from "@trizum/ui/Button";
import { Avatar } from "@trizum/ui/Avatar";
import { Alert, AlertDescription } from "@trizum/ui/Alert";
import { Icon } from "@trizum/ui/Icon";
import { z } from "zod";
import { partyViewSchema, type PartyView } from "./contracts.js";
import "./widget.css";

const app = new App({ name: "trizum", version: "0.1.0" });
const root = createRoot(document.getElementById("root")!);
const i18n = setupI18n({ locale: "en", messages: { en, es } });

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
    <main className="text-accent-950 dark:text-accent-50 space-y-6 p-5 text-sm sm:p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight wrap-anywhere">
          {party.symbol} {party.name}
        </h1>
        {party.description && (
          <p className="text-accent-700 dark:text-accent-200 leading-relaxed wrap-anywhere">
            {party.description}
          </p>
        )}
      </header>
      <section aria-labelledby="balances-heading" className="space-y-2">
        <h2 id="balances-heading" className="text-base font-semibold">
          {labels.balancesLabel}
        </h2>
        <ul className="divide-accent-100 dark:divide-accent-800 divide-y">
          {party.participants.map((person) => (
            <li key={person.id} className="flex items-center gap-3 py-3">
              <span aria-hidden="true">
                <Avatar name={person.name} className="size-9 shrink-0" />
              </span>
              <span className="min-w-0 flex-1 wrap-anywhere">{person.name}</span>
              <span className="shrink-0 font-medium tabular-nums">{format(person.balance)}</span>
            </li>
          ))}
        </ul>
      </section>
      {party.expenses.length > 0 && (
        <section aria-labelledby="expenses-heading" className="space-y-2">
          <h2 id="expenses-heading" className="text-base font-semibold">
            {labels.expensesLabel}
          </h2>
          <ul className="divide-accent-100 dark:divide-accent-800 divide-y">
            {party.expenses.map((expense) => (
              <li key={expense.id} className="flex items-center justify-between gap-4 py-3">
                <span className="min-w-0 wrap-anywhere">{expense.name}</span>
                <span className="shrink-0 tabular-nums">{format(expense.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Button
        color="accent"
        className="gap-2 font-semibold"
        pressAction={async () => {
          setOpenFailed(false);

          try {
            const result = await app.openLink({ url: url.href }, { timeout: 5000 });
            setOpenFailed(result.isError === true);
          } catch {
            setOpenFailed(true);
          }
        }}
      >
        {labels.openLabel}
        <Icon icon="lucide.external-link" className="size-4" />
      </Button>
      {openFailed && (
        <Alert>
          <Icon icon="lucide.link" />
          <AlertDescription>
            <p>{labels.openErrorLabel}</p>
            <code className="wrap-anywhere select-all">{url.href}</code>
          </AlertDescription>
        </Alert>
      )}
    </main>
  );
}

app.addEventListener("toolresult", (result) => {
  if (result.isError) {
    const error = z.object({ errorLabel: z.string() }).safeParse(result._meta);

    if (error.success)
      root.render(
        <Alert variant="destructive">
          <AlertDescription>{error.data.errorLabel}</AlertDescription>
        </Alert>,
      );

    return;
  }

  const party = partyViewSchema.safeParse(result.structuredContent);
  const labels = labelsSchema.safeParse(result._meta);

  if (party.success && labels.success) {
    document.documentElement.lang = labels.data.locale;
    i18n.activate(labels.data.locale.startsWith("es") ? "es" : "en");
    root.render(
      <I18nProvider i18n={i18n}>
        <UIProvider locale={labels.data.locale} spriteHref="">
          <PartyCard key={party.data.partyId} party={party.data} labels={labels.data} />
        </UIProvider>
      </I18nProvider>,
    );
  }
});

function applyHostTheme() {
  const theme = app.getHostContext()?.theme;
  document.documentElement.classList.toggle(
    "dark",
    theme === "dark" ||
      (theme === undefined && window.matchMedia("(prefers-color-scheme: dark)").matches),
  );
}

app.addEventListener("hostcontextchanged", applyHostTheme);

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyHostTheme);

applyHostTheme();

void app.connect().then(applyHostTheme);
