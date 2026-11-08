import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@trizum/ui/Button";
import { AppSelect, SelectItem } from "@trizum/ui/Select";
import { AppTextField } from "@trizum/ui/fields/TextField";
import {
  paymentMethodDescriptions,
  paymentMethodLabels,
  validatePaymentMethod,
} from "#src/lib/paymentMethods.ts";
import { paymentMethodTypes, type PaymentMethods } from "#src/models/paymentMethod.ts";
import { PaymentMethodIcon } from "./PaymentMethodIcon.tsx";

export function PaymentMethodsEditor({
  value,
  onChange,
}: {
  value: PaymentMethods;
  onChange: (value: PaymentMethods) => void;
}) {
  const { t } = useLingui();
  const available = paymentMethodTypes.filter((type) => value[type] === undefined);

  return (
    <section className="border-accent-200 dark:border-accent-800 flex flex-col gap-4 border-y py-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">
          <Trans>Get paid</Trans>
        </h2>
        <p className="text-accent-700 dark:text-accent-300 text-sm">
          <Trans>
            Add the ways people can pay you. These details are shared with everyone in your groups.
          </Trans>
        </p>
      </div>
      {paymentMethodTypes.map((type) => {
        const details = value[type];

        if (details === undefined) return null;
        const methodName = t(paymentMethodLabels[type]);
        const error = validatePaymentMethod(type, details);

        return (
          <div
            key={type}
            className="dark:bg-accent-900 flex flex-col gap-3 rounded-xl bg-white p-4"
            autoCapitalize="none"
          >
            <div className="flex items-start gap-3">
              <PaymentMethodIcon type={type} />
              <AppTextField
                className="min-w-0 flex-1"
                label={methodName}
                description={t(paymentMethodDescriptions[type])}
                name={`paymentMethods.${type}`}
                value={details}
                onChange={(details) => onChange({ ...value, [type]: details })}
                textArea={type === "other" || type === "bank-transfer"}
                isRequired
                maxLength={type === "bizum" ? 20 : 1000}
                isInvalid={details.length > 0 && !!error}
                errorMessage={error ?? undefined}
              />
            </div>
            <Button
              type="button"
              aria-label={t({ message: `Remove ${methodName}` })}
              onPress={() => {
                const remaining = { ...value };
                delete remaining[type];
                onChange(remaining);
              }}
            >
              <Trans>Remove</Trans>
            </Button>
          </div>
        );
      })}
      {available.length > 0 ? (
        <AppSelect
          label={t`Add payment method`}
          placeholder={t`Choose a payment method`}
          selectedKey={null}
          onSelectionChange={(key) => {
            const type = available.find((type) => type === key);

            if (type) onChange({ ...value, [type]: "" });
          }}
        >
          {available.map((type) => (
            <SelectItem key={type} id={type} textValue={t(paymentMethodLabels[type])}>
              <span className="flex items-center gap-3">
                <PaymentMethodIcon type={type} size={20} />
                {t(paymentMethodLabels[type])}
              </span>
            </SelectItem>
          ))}
        </AppSelect>
      ) : null}
    </section>
  );
}
