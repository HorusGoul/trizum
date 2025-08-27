import { cn } from "#src/ui/utils.js";
import Dinero, { type Currency } from "dinero.js";

export interface CurrencyTextProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number;
  currency: Currency;
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
      {Dinero({ amount, currency }).setLocale("es-ES").toFormat(format)}
    </span>
  );
}
