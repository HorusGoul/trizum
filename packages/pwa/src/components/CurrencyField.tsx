import { AppNumberField, type AppNumberFieldProps } from "#src/ui/TextField.js";

export interface CurrencyFieldProps extends AppNumberFieldProps {}

export function CurrencyField({ ...props }: CurrencyFieldProps) {
  return (
    <AppNumberField
      {...props}
      formatOptions={{
        style: "decimal",
      }}
    />
  );
}
