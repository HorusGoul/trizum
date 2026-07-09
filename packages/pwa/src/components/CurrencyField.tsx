import { t } from "@lingui/core/macro";
import { AppCurrencyField } from "#src/ui/fields/TextField.js";
import React, { use, useEffect, useRef, useState } from "react";
import { CurrencyContext } from "./CurrencyContext";
import { useCalculatorMode } from "#src/hooks/useCalculatorMode.ts";
import { CalculatorToolbar } from "./CalculatorToolbar";
import { IconButton } from "#src/ui/IconButton.js";
import { cn } from "#src/ui/utils.js";
import { getPresenceElementIdFromTarget } from "./presencePosition.ts";
import type { MediaFile } from "#src/models/media.ts";

export type CurrencyFieldProps = React.ComponentProps<typeof AppCurrencyField> & {
  calculator?: boolean;
  calculatorButtonClassName?: string;
  calculatorAttachmentPhotoIds?: MediaFile["id"][];
  autoOpenCalculator?: boolean;
  calculatorId?: string;
  activeCalculatorId?: string;
  onOpenCalculator?: (calculatorId: string) => void;
  onCloseCalculator?: () => void;
};

function getCalculatorFieldLabel(props: React.ComponentProps<typeof AppCurrencyField>) {
  const ariaLabel = (props as { "aria-label"?: unknown })["aria-label"];

  return props.label || (typeof ariaLabel === "string" ? ariaLabel : undefined);
}

export function CurrencyField({
  calculator = false,
  calculatorButtonClassName,
  calculatorAttachmentPhotoIds,
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
      calculatorAttachmentPhotoIds={calculatorAttachmentPhotoIds}
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
  calculatorAttachmentPhotoIds,
  autoOpenCalculator = false,
  calculatorId,
  activeCalculatorId,
  onOpenCalculator,
  onCloseCalculator,
  ...props
}: React.ComponentProps<typeof AppCurrencyField> & {
  calculatorButtonClassName?: string;
  calculatorAttachmentPhotoIds?: MediaFile["id"][];
  autoOpenCalculator?: boolean;
  calculatorId?: string;
  activeCalculatorId?: string;
  onOpenCalculator?: (calculatorId: string) => void;
  onCloseCalculator?: () => void;
}) {
  /* eslint-disable react-doctor/no-adjust-state-on-prop-change, react-doctor/no-cascading-set-state, react-doctor/no-chain-state-updates, react-doctor/no-event-handler -- Browser back/forward changes route calculator state outside press handlers. */
  const configuredPresenceElementId =
    (props as { "data-presence-element-id"?: string })["data-presence-element-id"] ??
    (props as { "data-presence-proxy-element-id"?: string })["data-presence-proxy-element-id"];
  const fieldContainerRef = useRef<HTMLDivElement>(null);
  const calculatorPresenceElementIdRef = useRef<string | null>(configuredPresenceElementId ?? null);
  const isClosingFromCalculatorRef = useRef(false);
  const [calculatorCloseState, setCalculatorCloseState] = useState({
    requestId: 0,
    isClosedFromCalculator: false,
    isClosingFromRouteChange: false,
  });
  const { requestId, isClosedFromCalculator, isClosingFromRouteChange } = calculatorCloseState;
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
  const isCalculatorRouteActive = isRouteControlled && activeCalculatorId === calculatorFieldId;
  const isRouteClosePending =
    isRouteControlled &&
    activeCalculatorId === undefined &&
    state.isActive &&
    !isClosedFromCalculator &&
    !isClosingFromCalculatorRef.current;
  const shouldRenderCalculator = isRouteControlled
    ? state.isActive &&
      !isClosedFromCalculator &&
      (isCalculatorRouteActive || isClosingFromRouteChange || isRouteClosePending)
    : state.isActive;
  const isCalculatorActive = isRouteControlled
    ? !isClosedFromCalculator &&
      (isCalculatorRouteActive || isClosingFromRouteChange || isRouteClosePending)
    : state.isActive;
  const shouldPreventNativeKeyboard = autoOpenCalculator || isCalculatorActive;
  const fieldLabel = getCalculatorFieldLabel(props);

  useEffect(() => {
    if (!isRouteControlled) {
      return;
    }

    if (activeCalculatorId === calculatorFieldId) {
      if (state.isActive) {
        return;
      }

      isClosingFromCalculatorRef.current = false;
      setCalculatorCloseState((currentState) => ({
        ...currentState,
        isClosedFromCalculator: false,
        isClosingFromRouteChange: false,
      }));
      calculatorPresenceElementIdRef.current =
        configuredPresenceElementId ?? getPresenceElementIdFromTarget(fieldContainerRef.current);
      actions.activate({ selectAll: true });
      return;
    }

    if (activeCalculatorId !== calculatorFieldId && state.isActive) {
      if (activeCalculatorId === undefined) {
        if (isClosingFromCalculatorRef.current) {
          blurFocusedCalculatorField();
          actions.deactivate();
          setCalculatorCloseState((currentState) => ({
            ...currentState,
            isClosedFromCalculator: true,
            isClosingFromRouteChange: false,
          }));
        } else if (!isClosingFromRouteChange) {
          setCalculatorCloseState((currentState) => ({
            requestId: currentState.requestId + 1,
            isClosedFromCalculator: false,
            isClosingFromRouteChange: true,
          }));
        }
        return;
      }

      setCalculatorCloseState((currentState) => ({
        ...currentState,
        isClosedFromCalculator: false,
        isClosingFromRouteChange: false,
      }));
      blurFocusedCalculatorField();
      actions.deactivate();
    }
  }, [
    actions,
    activeCalculatorId,
    calculatorFieldId,
    configuredPresenceElementId,
    isClosingFromRouteChange,
    isRouteControlled,
    state.isActive,
  ]);
  /* eslint-enable react-doctor/no-adjust-state-on-prop-change, react-doctor/no-cascading-set-state, react-doctor/no-chain-state-updates, react-doctor/no-event-handler */

  function openCalculator() {
    calculatorPresenceElementIdRef.current =
      configuredPresenceElementId ?? getPresenceElementIdFromTarget(fieldContainerRef.current);
    isClosingFromCalculatorRef.current = false;
    setCalculatorCloseState((currentState) => ({
      ...currentState,
      isClosedFromCalculator: false,
      isClosingFromRouteChange: false,
    }));
    actions.activate({ selectAll: true });
    onOpenCalculator?.(calculatorFieldId);
  }

  function blurFocusedCalculatorField() {
    const activeElement = document.activeElement;

    if (
      activeElement instanceof HTMLElement &&
      fieldContainerRef.current?.contains(activeElement)
    ) {
      activeElement.blur();
    }
  }

  function requestCloseCalculator() {
    setCalculatorCloseState((currentState) => ({
      ...currentState,
      requestId: currentState.requestId + 1,
    }));
  }

  function closeCalculator() {
    const shouldCloseRoute = !isClosingFromRouteChange;
    if (shouldCloseRoute) {
      isClosingFromCalculatorRef.current = true;
    }
    setCalculatorCloseState((currentState) => ({
      ...currentState,
      isClosedFromCalculator: shouldCloseRoute || currentState.isClosedFromCalculator,
      isClosingFromRouteChange: false,
    }));
    blurFocusedCalculatorField();
    actions.deactivate();
    if (shouldCloseRoute) {
      onCloseCalculator?.();
    }
  }

  function commitCalculator() {
    actions.commit();
    closeCalculator();
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
      onPress={isCalculatorActive ? requestCloseCalculator : openCalculator}
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

      {shouldRenderCalculator && (
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
          closeRequestId={requestId}
          attachmentPhotoIds={calculatorAttachmentPhotoIds}
          fieldContainerRef={fieldContainerRef}
          presenceElementId={calculatorPresenceElementIdRef.current ?? configuredPresenceElementId}
          previewValue={state.previewValue}
          currency={props.currency}
          dismissOnOutsideInteraction
          fieldLabel={fieldLabel}
        />
      )}
    </div>
  );
}
