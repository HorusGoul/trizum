// @vitest-environment jsdom
import type { CurrencyCode } from "../lib/money";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { useForm } from "@tanstack/react-form";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { PwaUIProvider } from "./PwaUIProvider";
import { CurrencyContext } from "./CurrencyContext";
import { ExpenseCurrencyFields } from "./ExpenseCurrencyFields";
import type { ExpenseEditorFormValues } from "./ExpenseEditor";
import type { AppFormApi } from "../lib/reactFormTypes";

let root: Root;
let container: HTMLDivElement;
let form: AppFormApi<ExpenseEditorFormValues>;

function Fixture({ values }: { values: ExpenseEditorFormValues }) {
  const api = useForm({ defaultValues: values });
  useEffect(() => {
    form = api;
  }, [api]);

  return (
    <ExpenseCurrencyFields
      form={api}
      photos={[]}
      createFieldFocusHandlers={(field) => ({ onFocus() {}, onBlur: field.handleBlur })}
    />
  );
}

beforeEach(() => {
  i18n.load("en", {});
  i18n.activate("en");
  // SAFETY: React's documented test-only flag is absent from production global types.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async () =>
      Response.json({
        base: "EUR",
        rates: {
          EUR: { rate: 1, date: "2099-01-01" },
          USD: { rate: 2, date: "2099-01-01" },
        },
      }),
    ),
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render(
  values: Partial<ExpenseEditorFormValues> = {},
  partyCurrency: CurrencyCode = "EUR",
) {
  const defaults: ExpenseEditorFormValues = {
    name: "Dinner",
    amount: 100,
    paidAt: new Date(),
    paidBy: "alice",
    shares: { alice: { type: "divide", value: 1 } },
    photos: [],
    ...values,
  };

  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <PwaUIProvider>
          <CurrencyContext value={partyCurrency}>
            <Fixture values={defaults} />
          </CurrencyContext>
        </PwaUIProvider>
      </I18nProvider>,
    ),
  );
}

function field(label: string) {
  const element = Array.from(container.querySelectorAll("label")).find(
    (item) => item.textContent === label,
  );

  const input = document.getElementById(element?.htmlFor ?? "");

  if (!(input instanceof HTMLInputElement)) throw new Error(`Missing field: ${label}`);

  return input;
}

async function enter(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

  if (!setter) throw new Error("Input value setter is unavailable");
  await act(async () => {
    input.focus();
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => input.blur());
}

async function choose(currency: string) {
  const select = container.querySelector("select");

  if (!select) throw new Error("Missing currency select");
  await act(async () => {
    select.value = currency;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

test("reopening a foreign expense preserves its saved rate through a late reference refresh", async () => {
  let resolve!: (response: Response) => void;

  const pending = new Promise<Response>((resolvePromise) => {
    resolve = resolvePromise;
  });

  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(() => pending),
  );
  await render({
    amount: 80,
    originalAmount: { amount: 10000, currency: "USD" },
    exchangeRate: 0.8,
  });
  expect(form.state.values.amount).toBe(80);
  expect(form.state.values.exchangeRate).toBe(0.8);
  await act(async () =>
    resolve(
      Response.json({
        base: "EUR",
        rates: {
          EUR: { rate: 1, date: "2099-01-01" },
          USD: { rate: 2, date: "2099-01-01" },
        },
      }),
    ),
  );
  expect(form.state.values.amount).toBe(80);
  expect(form.state.values.exchangeRate).toBe(0.8);
  expect(field("Exchange rate").value).toBe("0.8");
  expect(field("Converted amount (EUR)").value).toBe("80");
  expect(field("Converted amount (EUR)").readOnly).toBe(true);
});

test("selects a foreign currency, edits its amount and rate, and switches back to the party currency", async () => {
  await render();
  expect(field("Amount").readOnly).toBe(false);
  await choose("USD");
  expect(field("Converted amount (EUR)").readOnly).toBe(true);
  expect(field("Original amount (USD)").readOnly).toBe(false);
  expect(form.state.values).toMatchObject({
    amount: 50,
    originalAmount: { currency: "USD", amount: 10000 },
    exchangeRate: 0.5,
  });
  await enter(field("Original amount (USD)"), "40");
  expect(form.state.values.amount).toBe(20);
  await enter(field("Exchange rate"), "0.25");
  expect(form.state.values).toMatchObject({
    amount: 10,
    originalAmount: { amount: 4000, currency: "USD" },
    exchangeRate: 0.25,
  });
  await choose("EUR");
  expect(field("Amount").readOnly).toBe(false);
  expect(form.state.values).toMatchObject({ amount: 10, originalAmount: null, exchangeRate: null });
});

test("accepts a manually entered rate for a currency with no reference rate", async () => {
  await render({
    amount: 0,
    originalAmount: { amount: 10000, currency: "XXX" },
    exchangeRate: null,
  });
  expect(field("Exchange rate").value).toBe("");
  await enter(field("Exchange rate"), "0.75");
  expect(form.state.values).toMatchObject({ amount: 75, exchangeRate: 0.75 });
  await enter(field("Exchange rate"), "");
  expect(form.state.values).toMatchObject({ amount: 0, exchangeRate: null });
});

test("uses the party currency as the API base and the converted amount currency", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
    expect(new Request(input).url).toContain("base=GBP");

    return Response.json({
      base: "GBP",
      rates: { GBP: { rate: 1, date: "2099-01-01" }, USD: { rate: 2, date: "2099-01-01" } },
    });
  });

  vi.stubGlobal("fetch", fetch);
  await render({}, "GBP");
  await choose("USD");
  expect(fetch).toHaveBeenCalledOnce();
  expect(form.state.values).toMatchObject({
    amount: 50,
    originalAmount: { currency: "USD", amount: 10000 },
    exchangeRate: 0.5,
  });
  expect(field("Converted amount (GBP)").readOnly).toBe(true);
});
