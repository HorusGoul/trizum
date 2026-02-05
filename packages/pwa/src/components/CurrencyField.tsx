import { t } from "@lingui/core/macro";
import { AppCurrencyField } from "#src/ui/TextField.js";
import React, { use, useRef } from "react";
import { CurrencyContext } from "./CurrencyContext";
import { useCalculatorMode } from "#src/hooks/useCalculatorMode.ts";
import { CalculatorToolbar } from "./CalculatorToolbar";
import { IconButton } from "#src/ui/IconButton.js";

export type CurrencyFieldProps = React.ComponentProps<
  typeof AppCurrencyField
> & {
  calculator?: boolean;
};

export function CurrencyField({
  calculator = false,
  ...props
}: CurrencyFieldProps) {
  const currency = use(CurrencyContext);

  if (!calculator) {
    return <AppCurrencyField {...props} currency={currency} />;
  }

  return <CurrencyFieldWithCalculator {...props} currency={currency} />;
}

function CurrencyFieldWithCalculator(
  props: React.ComponentProps<typeof AppCurrencyField>,
) {
  const expressionInputRef = useRef<HTMLInputElement>(null);
  const fieldContainerRef = useRef<HTMLDivElement>(null);
  const [state, actions] = useCalculatorMode({
    value: props.value ?? 0,
    onChange: (value) => props.onChange?.(value),
    expressionInputRef,
    fieldContainerRef,
  });

  return (
    <div className="relative" ref={fieldContainerRef}>
      <AppCurrencyField
        {...props}
        value={props.value}
        isReadOnly={state.isActive}
      />

      {!state.isActive && (
        <IconButton
          icon="#lucide/sigma"
          aria-label={t`Open calculator`}
          color="transparent"
          className="absolute bottom-0.5 right-0.5 h-6 w-6"
          iconClassName="size-3.5"
          onPress={actions.activate}
        />
      )}

      {state.isActive && (
        <CalculatorToolbar
          expression={state.expression}
          onExpressionChange={actions.setExpression}
          onOperator={actions.appendOperator}
          onCommit={actions.commit}
          onClear={actions.clear}
          onDismiss={actions.deactivate}
          expressionInputRef={expressionInputRef}
          previewValue={state.previewValue}
        />
      )}
    </div>
  );
}
