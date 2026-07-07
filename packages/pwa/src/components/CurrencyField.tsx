import { t } from "@lingui/core/macro";
import { AppCurrencyField } from "#src/ui/fields/TextField.js";
import React, { use, useEffect, useRef } from "react";
import { CurrencyContext } from "./CurrencyContext";
import { useCalculatorMode } from "#src/hooks/useCalculatorMode.ts";
import { CalculatorToolbar } from "./CalculatorToolbar";
import { IconButton } from "#src/ui/IconButton.js";
import { cn } from "#src/ui/utils.js";
import { getPresenceElementIdFromTarget } from "./presencePosition.ts";

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
  const configuredPresenceElementId =
    (props as { "data-presence-element-id"?: string })["data-presence-element-id"] ??
    (props as { "data-presence-proxy-element-id"?: string })["data-presence-proxy-element-id"];
  const fieldContainerRef = useRef<HTMLDivElement>(null);
  const calculatorPresenceElementIdRef = useRef<string | null>(configuredPresenceElementId ?? null);
  const [state, actions] = useCalculatorMode({
    value: props.value ?? 0,
    onChange: (value) => props.onChange?.(value),
    currency: props.currency,
  });
  const calculatorFieldId = calculatorId ?? configuredPresenceElementId ?? props.name ?? "currency";
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
      calculatorPresenceElementIdRef.current =
        configuredPresenceElementId ?? getPresenceElementIdFromTarget(fieldContainerRef.current);
      actions.activate({ selectAll: true });
      return;
    }

    if (activeCalculatorId !== calculatorFieldId && state.isActive) {
      actions.deactivate();
    }
  }, [
    actions,
    activeCalculatorId,
    calculatorFieldId,
    configuredPresenceElementId,
    isRouteControlled,
    state.isActive,
  ]);
  /* eslint-enable react-doctor/no-event-handler */

  function openCalculator() {
    calculatorPresenceElementIdRef.current =
      configuredPresenceElementId ?? getPresenceElementIdFromTarget(fieldContainerRef.current);
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

  const calculatorButton = (
    <IconButton
      icon={isCalculatorActive ? "lucide.x" : "lucide.calculator"}
      aria-label={isCalculatorActive ? t`Close calculator` : t`Open calculator`}
      color="transparent"
      data-presence-proxy-element-id={configuredPresenceElementId}
      className={calculatorButtonClassName ?? "absolute top-1/2 right-1 h-8 w-8 -translate-y-1/2"}
      iconClassName="size-4"
      onPress={isCalculatorActive ? closeCalculator : openCalculator}
    />
  );

  return (
    <div ref={fieldContainerRef}>
      <AppCurrencyField
        {...props}
        value={props.value}
        inputMode={shouldPreventNativeKeyboard ? "none" : props.inputMode}
        isReadOnly={props.isReadOnly || shouldPreventNativeKeyboard}
        onFocus={handleFocus}
        inputClassName={cn(
          props.inputClassName,
          !calculatorButtonClassName && "pr-12",
          isCalculatorActive && "ring-ring ring-2 ring-offset-2",
        )}
        inputEndAdornment={calculatorButton}
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
          presenceElementId={calculatorPresenceElementIdRef.current ?? configuredPresenceElementId}
          previewValue={state.previewValue}
          currency={props.currency}
          dismissOnOutsideInteraction={!isRouteControlled}
        />
      )}
    </div>
  );
}
