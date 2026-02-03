import { AppCurrencyField } from "#src/ui/TextField.js";
import React, { use } from "react";
import { CurrencyContext } from "./CurrencyContext";

export type CurrencyFieldProps = React.ComponentProps<typeof AppCurrencyField>;

/** @renders {AppCurrencyField} */
export function CurrencyField({ ...props }: CurrencyFieldProps) {
  const currency = use(CurrencyContext);

  return <AppCurrencyField {...props} currency={currency} />;
}
