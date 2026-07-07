import { t } from "@lingui/core/macro";
import { AppCurrencyField } from "#src/ui/fields/TextField.js";
import React, { use, useEffect, useRef } from "react";
import { CurrencyContext } from "./CurrencyContext";
import { useCalculatorMode } from "#src/hooks/useCalculatorMode.ts";
import { CalculatorToolbar } from "./CalculatorToolbar";
import { IconButton } from "#src/ui/IconButton.js";
import { cn } from "#src/ui/utils.js";

export type CurrencyFieldProps = React.ComponentProps<typeof AppCurrencyField> & {
  calculator?: boolean;
  calculatorButtonClassName?: string;
  autoOpenCalculator?: boolean;
  calculatorId?: string;
  activeCalculatorId?: string;
  onOpenCalculator?: (calculatorId: string) => void;
  onCloseCalculator?: () => void;
};

export function CurrencyField({
  calculator = false,
  calculatorButtonClassName,
  autoOpenCalculator = false,
  calculatorId,
  activeCalculatorId,
  onOpenCalculator,
  onCloseCalculator,
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
      calculatorId={calculatorId}
      activeCalculatorId={activeCalculatorId}
      onOpenCalculator={onOpenCalculator}
      onCloseCalculator={onCloseCalculator}
    />
  );
}

function CurrencyFieldWithCalculator({
  calculatorButtonClassName,
  autoOpenCalculator = false,
  calculatorId,
  activeCalculatorId,
  onOpenCalculator,
  onCloseCalculator,
  ...props
}: React.ComponentProps<typeof AppCurrencyField> & {
  calculatorButtonClassName?: string;
  autoOpenCalculator?: boolean;
  calculatorId?: string;
  activeCalculatorId?: string;
  onOpenCalculator?: (calculatorId: string) => void;
  onCloseCalculator?: () => void;
}) {
  /* eslint-disable react-doctor/no-event-handler -- Browser back/forward changes route calculator state outside press handlers. */
  const presenceElementId = (props as { "data-presence-element-id"?: string })[
    "data-presence-element-id"
  ];
  const fieldContainerRef = useRef<HTMLDivElement>(null);
  const [state, actions] = useCalculatorMode({
    value: props.value ?? 0,
    onChange: (value) => props.onChange?.(value),
    currency: props.currency,
  });
  const calculatorFieldId = calculatorId ?? presenceElementId ?? props.name ?? "currency";
  const isRouteControlled =
    activeCalculatorId !== undefined ||
    onOpenCalculator !== undefined ||
    onCloseCalculator !== undefined;
  const isCalculatorActive = isRouteControlled
    ? activeCalculatorId === calculatorFieldId
    : state.isActive;
  const shouldPreventNativeKeyboard = autoOpenCalculator || isCalculatorActive;

  useEffect(() => {
    if (!isRouteControlled) {
      return;
    }

    if (activeCalculatorId === calculatorFieldId && !state.isActive) {
      actions.activate({ selectAll: true });
      return;
    }

    if (activeCalculatorId !== calculatorFieldId && state.isActive) {
      actions.deactivate();
    }
  }, [actions, activeCalculatorId, calculatorFieldId, isRouteControlled, state.isActive]);
  /* eslint-enable react-doctor/no-event-handler */

  function openCalculator() {
    actions.activate({ selectAll: true });
    onOpenCalculator?.(calculatorFieldId);
  }

  function closeCalculator() {
    actions.deactivate();
    onCloseCalculator?.();
  }

  function commitCalculator() {
    actions.commit();
    onCloseCalculator?.();
  }

  function handleFocus(event: React.FocusEvent<HTMLInputElement>) {
    props.onFocus?.(event);

    if (autoOpenCalculator && !isCalculatorActive) {
      openCalculator();
    }
  }

  return (
    <div className="relative" ref={fieldContainerRef}>
      <AppCurrencyField
        {...props}
        value={props.value}
        inputMode={shouldPreventNativeKeyboard ? "none" : props.inputMode}
        isReadOnly={props.isReadOnly || shouldPreventNativeKeyboard}
        onFocus={handleFocus}
        inputClassName={cn(
          props.inputClassName,
          isCalculatorActive && "ring-ring ring-2 ring-offset-2",
        )}
      />

      <IconButton
        icon={isCalculatorActive ? "lucide.x" : "lucide.calculator"}
        aria-label={isCalculatorActive ? t`Close calculator` : t`Open calculator`}
        color="transparent"
        className={calculatorButtonClassName ?? "absolute right-1 bottom-1 h-8 w-8"}
        iconClassName="size-4"
        onPress={isCalculatorActive ? closeCalculator : openCalculator}
      />

      {isCalculatorActive && state.isActive && (
        <CalculatorToolbar
          expression={state.expression}
          cursorPosition={state.cursorPosition}
          selectionRange={state.selectionRange}
          onInsert={actions.insertAtCursor}
          onBackspace={actions.backspace}
          onMoveCursor={actions.moveCursor}
          onSetCursorPosition={actions.setCursorPosition}
          onCommit={commitCalculator}
          onClear={actions.clear}
          onDismiss={closeCalculator}
          fieldContainerRef={fieldContainerRef}
          presenceElementId={presenceElementId}
          previewValue={state.previewValue}
          currency={props.currency}
          dismissOnOutsideInteraction={!isRouteControlled}
        />
      )}
    </div>
  );
}
