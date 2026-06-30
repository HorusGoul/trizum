import {
  add,
  dinero,
  equal,
  greaterThan,
  halfEven,
  lessThan,
  multiply as multiplyDinero,
  subtract,
  toDecimal,
  toSnapshot,
  transformScale,
  type Dinero,
  type DineroCurrency,
  type DineroScaledAmount,
} from "dinero.js";
import * as dineroCurrencies from "dinero.js/currencies";

const APP_MONEY_SCALE = 2;
const DEFAULT_CURRENCY = "USD";
const currencyByCode = dineroCurrencies as Record<string, DineroCurrency<number>>;

export type Currency = string;

export interface Money {
  add(addend: Money): Money;
  subtract(subtrahend: Money): Money;
  multiply(multiplier: number): Money;
  lessThan(comparator: Money): boolean;
  greaterThan(comparator: Money): boolean;
  equalsTo(comparator: Money): boolean;
  getAmount(): number;
  toDecimal(): string;
}

interface MoneyOptions {
  amount: number;
  currency?: Currency;
}

interface FormatMoneyOptions {
  amount: number;
  currency: Currency;
  format: "$0.00" | "0.00";
  locale: string;
}

class DineroMoney implements Money {
  constructor(readonly value: Dinero<number>) {}

  add(addend: Money) {
    return new DineroMoney(add(this.value, unwrapMoney(addend)));
  }

  subtract(subtrahend: Money) {
    return new DineroMoney(subtract(this.value, unwrapMoney(subtrahend)));
  }

  multiply(multiplier: number) {
    const multiplied = multiplyDinero(this.value, toScaledAmount(multiplier));
    return new DineroMoney(transformScale(multiplied, APP_MONEY_SCALE, halfEven));
  }

  lessThan(comparator: Money) {
    return lessThan(this.value, unwrapMoney(comparator));
  }

  greaterThan(comparator: Money) {
    return greaterThan(this.value, unwrapMoney(comparator));
  }

  equalsTo(comparator: Money) {
    return equal(this.value, unwrapMoney(comparator));
  }

  getAmount() {
    return toSnapshot(this.value).amount;
  }

  toDecimal() {
    return toDecimal(this.value);
  }
}

export function createMoney({ amount, currency = DEFAULT_CURRENCY }: MoneyOptions): Money {
  return new DineroMoney(
    dinero({
      amount,
      currency: getDineroCurrency(currency),
      scale: APP_MONEY_SCALE,
    }),
  );
}

export function formatMoney({ amount, currency, format, locale }: FormatMoneyOptions) {
  const value = Number(createMoney({ amount, currency }).toDecimal());
  const options: Intl.NumberFormatOptions =
    format === "$0.00"
      ? { currency, maximumFractionDigits: 2, minimumFractionDigits: 2, style: "currency" }
      : { maximumFractionDigits: 2, minimumFractionDigits: 2 };

  return value.toLocaleString(locale, options);
}

function getDineroCurrency(currency: Currency): DineroCurrency<number> {
  return currencyByCode[currency] ?? { base: 10, code: currency, exponent: APP_MONEY_SCALE };
}

function unwrapMoney(money: Money) {
  return (money as DineroMoney).value;
}

function toScaledAmount(value: number): DineroScaledAmount<number> | number {
  if (Number.isInteger(value)) {
    return value;
  }

  const [coefficient, exponentText] = value.toString().toLowerCase().split("e");

  if (exponentText === undefined) {
    const sign = coefficient.startsWith("-") ? -1 : 1;
    const [integerPart, fractionalPart = ""] = coefficient.replace("-", "").split(".");

    return {
      amount: sign * Number(`${integerPart}${fractionalPart}`),
      scale: fractionalPart.length,
    };
  }

  const sign = coefficient.startsWith("-") ? -1 : 1;
  const [integerPart, fractionalPart = ""] = coefficient.replace("-", "").split(".");
  const digits = `${integerPart}${fractionalPart}`;
  const scale = fractionalPart.length - Number(exponentText);

  if (scale <= 0) {
    return sign * Number(`${digits}${"0".repeat(Math.abs(scale))}`);
  }

  return {
    amount: sign * Number(digits),
    scale,
  };
}
