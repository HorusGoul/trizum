import { dinero, toSnapshot, type Dinero, type DineroCurrency } from "dinero.js";
import { EUR } from "dinero.js/currencies";
import * as currencies from "dinero.js/currencies";

const trizumCurrencies = {
  ANG: { code: "ANG", base: 10, exponent: 2 },
  CUC: { code: "CUC", base: 10, exponent: 2 },
  HRK: { code: "HRK", base: 10, exponent: 2 },
  SLL: { code: "SLL", base: 10, exponent: 2 },
  XAG: { code: "XAG", base: 10, exponent: 2 },
  XAU: { code: "XAU", base: 10, exponent: 2 },
  XBA: { code: "XBA", base: 10, exponent: 2 },
  XBB: { code: "XBB", base: 10, exponent: 2 },
  XBC: { code: "XBC", base: 10, exponent: 2 },
  XBD: { code: "XBD", base: 10, exponent: 2 },
  XDR: { code: "XDR", base: 10, exponent: 2 },
  XPD: { code: "XPD", base: 10, exponent: 2 },
  XPT: { code: "XPT", base: 10, exponent: 2 },
  XSU: { code: "XSU", base: 10, exponent: 2 },
  XTS: { code: "XTS", base: 10, exponent: 2 },
  XUA: { code: "XUA", base: 10, exponent: 2 },
  XXX: { code: "XXX", base: 10, exponent: 2 },
  ZWL: { code: "ZWL", base: 10, exponent: 2 },
} as const satisfies Record<string, DineroCurrency<number>>;

const appCurrencies = {
  ...currencies,
  ...trizumCurrencies,
};

export type CurrencyCode = keyof typeof appCurrencies;
export type Money = Dinero<number>;

export function createMoney(amount: number): Money {
  return dinero({ amount, currency: EUR });
}

export function getMoneyAmount(money: Money): number {
  return toSnapshot(money).amount;
}

export function isCurrencyCode(currency: string): currency is CurrencyCode {
  return currency in appCurrencies;
}

export function getDineroCurrency(currency: CurrencyCode): DineroCurrency<number, CurrencyCode> {
  return appCurrencies[currency];
}

export function getDisplayDineroCurrency(currency: CurrencyCode): DineroCurrency<number> {
  return {
    code: currency,
    base: 10,
    exponent: 2,
  };
}
