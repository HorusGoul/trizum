import { cn } from "#src/ui/utils.js";
import { dinero, toDecimal } from "dinero.js";
import { getDisplayDineroCurrency, type CurrencyCode } from "#src/lib/money.ts";

export interface CurrencyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number;
  currency: CurrencyCode;
  variant?: "diff" | "default" | "inherit";
  format?: "$0.00" | "0.00";
}

export function CurrencyText({
  amount,
  currency,
  className,
  variant = "default",
  format = "$0.00",
  ...props
}: CurrencyTextProps) {
  let color = "text-accent-400";

  if (variant === "diff") {
    if (amount < 0) {
      color = "text-danger-400";
    }

    if (amount > 0) {
      color = "text-success-400";
    }
  }

  if (variant === "inherit") {
    color = "text-inherit";
  }

  return (
    <span className={cn(color, className)} {...props}>
      {formatCurrencyAmount(amount, currency, format)}
    </span>
  );
}

function formatCurrencyAmount(
  amount: number,
  currency: CurrencyCode,
  format: NonNullable<CurrencyTextProps["format"]>,
) {
  const money = dinero({ amount, currency: getDisplayDineroCurrency(currency), scale: 2 });

  return toDecimal(money, ({ value, currency }) => {
    const numericValue = Number(value);

    if (format === "0.00") {
      return numericValue.toLocaleString("es-ES", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }

    return numericValue.toLocaleString("es-ES", {
      style: "currency",
      currency: currency.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  });
}
