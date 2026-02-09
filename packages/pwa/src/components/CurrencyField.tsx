import { t } from "@lingui/core/macro";
import { AppCurrencyField } from "#src/ui/TextField.js";
import React, { use, useRef } from "react";
import { CurrencyContext } from "./CurrencyContext";
import { useCalculatorMode } from "#src/hooks/useCalculatorMode.ts";
import { CalculatorToolbar } from "./CalculatorToolbar";
import { IconButton } from "#src/ui/IconButton.js";
import { cn } from "#src/ui/utils.js";

export type CurrencyFieldProps = React.ComponentProps<
  typeof AppCurrencyField
> & {
  calculator?: boolean;
  calculatorButtonClassName?: string;
  autoOpenCalculator?: boolean;
};

export function CurrencyField({
  calculator = false,
  calculatorButtonClassName,
  autoOpenCalculator = false,
  ...props
}: CurrencyFieldProps) {
  const currency = use(CurrencyContext);

  if (!calculator) {
    return <AppCurrencyField {...props} currency={currency} />;
  }

  return (
    <CurrencyFieldWithCalculator
      {...props}
      currency={currency}
      calculatorButtonClassName={calculatorButtonClassName}
      autoOpenCalculator={autoOpenCalculator}
    />
  );
}

function CurrencyFieldWithCalculator({
  calculatorButtonClassName,
  autoOpenCalculator = false,
  ...props
}: React.ComponentProps<typeof AppCurrencyField> & {
  calculatorButtonClassName?: string;
  autoOpenCalculator?: boolean;
}) {
  const presenceElementId = (props as { "data-presence-element-id"?: string })[
    "data-presence-element-id"
  ];
  const fieldContainerRef = useRef<HTMLDivElement>(null);
  const [state, actions] = useCalculatorMode({
    value: props.value ?? 0,
    onChange: (value) => props.onChange?.(value),
    fieldContainerRef,
    currency: props.currency,
  });

  function handleFocus(event: React.FocusEvent<HTMLInputElement>) {
    props.onFocus?.(event);

    if (autoOpenCalculator && !state.isActive) {
      actions.activate();
    }
  }

  return (
    <div className="relative" ref={fieldContainerRef}>
      <AppCurrencyField
        {...props}
        value={props.value}
        isReadOnly={state.isActive}
        onFocus={handleFocus}
        inputClassName={cn(
          props.inputClassName,
          state.isActive && "ring-ring ring-2 ring-offset-2",
        )}
      />

      <IconButton
        icon={state.isActive ? "#lucide/x" : "#lucide/calculator"}
        aria-label={state.isActive ? t`Close calculator` : t`Open calculator`}
        color="transparent"
        className={
          calculatorButtonClassName ?? "absolute bottom-1 right-1 h-8 w-8"
        }
        iconClassName="size-4"
        onPress={state.isActive ? actions.deactivate : actions.activate}
      />

      {state.isActive && (
        <CalculatorToolbar
          expression={state.expression}
          cursorPosition={state.cursorPosition}
          onInsert={actions.insertAtCursor}
          onBackspace={actions.backspace}
          onMoveCursor={actions.moveCursor}
          onSetCursorPosition={actions.setCursorPosition}
          onCommit={actions.commit}
          onClear={actions.clear}
          onDismiss={actions.deactivate}
          fieldContainerRef={fieldContainerRef}
          presenceElementId={presenceElementId}
          previewValue={state.previewValue}
          currency={props.currency}
        />
      )}
    </div>
  );
}
