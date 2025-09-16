import { AppNumberField, type AppNumberFieldProps } from "#src/ui/TextField.js";
import { use } from "react";
import { CurrencyContext } from "./CurrencyContext";

export interface CurrencyFieldProps extends AppNumberFieldProps {}

export function CurrencyField({ ...props }: CurrencyFieldProps) {
  const currency = use(CurrencyContext);

  return (
    <AppNumberField
      {...props}
      formatOptions={{
        style: "decimal",
        currency,
      }}
    />
  );
}
