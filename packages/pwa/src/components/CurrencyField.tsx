import { AppCurrencyField } from "#src/ui/TextField.js";
import React, { use } from "react";
import { CurrencyContext } from "./CurrencyContext";

export interface CurrencyFieldProps
  extends React.ComponentProps<typeof AppCurrencyField> {}

export function CurrencyField({ ...props }: CurrencyFieldProps) {
  const currency = use(CurrencyContext);

  return <AppCurrencyField {...props} currency={currency} />;
}
