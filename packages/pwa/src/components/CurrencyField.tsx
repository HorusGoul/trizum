import { t } from "@lingui/core/macro";
import { AppCurrencyField } from "#src/ui/fields/TextField.js";
import React, { use, useEffect, useRef, useState } from "react";
import { CurrencyContext } from "./CurrencyContext";
import { useCalculatorMode } from "#src/hooks/useCalculatorMode.ts";
import { CalculatorToolbar } from "./CalculatorToolbar";
import {
  allowCalculatorAutoOpenForUserInteraction,
  isCalculatorAutoOpenSuppressed,
  suppressCalculatorAutoOpen,
} from "./calculatorAutoOpenSuppression.ts";
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

type CurrencyFieldWithCalculatorProps = React.ComponentProps<typeof AppCurrencyField> & {
  calculatorButtonClassName?: string;
  calculatorAttachmentPhotoIds?: MediaFile["id"][];
  autoOpenCalculator?: boolean;
  calculatorId?: string;
  activeCalculatorId?: string;
  onOpenCalculator?: (calculatorId: string) => void;
  onCloseCalculator?: () => void;
};

type CurrencyFieldCalculatorState = {
  requestId: number;
  isClosedFromCalculator: boolean;
  isClosingFromRouteChange: boolean;
};

const CALCULATOR_FIELD_BUTTON_ATTRIBUTE = "data-calculator-field-button";
const CALCULATOR_BUTTON_FOCUS_IGNORE_MS = 750;

function getCalculatorFieldLabel(props: React.ComponentProps<typeof AppCurrencyField>) {
  const ariaLabel = (props as { "aria-label"?: unknown })["aria-label"];

  return props.label || (typeof ariaLabel === "string" ? ariaLabel : undefined);
}

function blurFocusedCalculatorField() {
  const activeElement = document.activeElement;

  if (activeElement instanceof HTMLElement && activeElement !== document.body) {
    activeElement.blur();
  }
}

function isCalculatorFieldButtonTarget(target: EventTarget | null) {
  return (
    target instanceof Element && target.closest(`[${CALCULATOR_FIELD_BUTTON_ATTRIBUTE}]`) !== null
  );
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

/* eslint-disable react-doctor/no-adjust-state-on-prop-change, react-doctor/no-cascading-set-state, react-doctor/no-chain-state-updates, react-doctor/no-event-handler -- Browser back/forward changes route calculator state outside press handlers. */
function useCurrencyFieldCalculator({
  activeCalculatorId,
  autoOpenCalculator,
  calculatorId,
  fieldProps,
  onCloseCalculator,
  onMouseDownCapture,
  onOpenCalculator,
  onPointerDownCapture,
}: {
  activeCalculatorId?: string;
  autoOpenCalculator: boolean;
  calculatorId?: string;
  fieldProps: React.ComponentProps<typeof AppCurrencyField>;
  onCloseCalculator?: () => void;
  onMouseDownCapture?: React.MouseEventHandler<HTMLDivElement>;
  onOpenCalculator?: (calculatorId: string) => void;
  onPointerDownCapture?: React.PointerEventHandler<HTMLDivElement>;
}) {
  const configuredPresenceElementId =
    (fieldProps as { "data-presence-element-id"?: string })["data-presence-element-id"] ??
    (fieldProps as { "data-presence-proxy-element-id"?: string })["data-presence-proxy-element-id"];
  const fieldContainerRef = useRef<HTMLDivElement>(null);
  const isClosingFromCalculatorRef = useRef(false);
  const lastCalculatorButtonInteractionTimeRef = useRef<number | null>(null);
  const pendingRouteOpenCalculatorIdRef = useRef<string | null>(null);
  const scheduledOpenTimeoutRef = useRef<number | null>(null);
  const [calculatorPresenceElementId, setCalculatorPresenceElementId] = useState(
    configuredPresenceElementId ?? null,
  );
  const [calculatorCloseState, setCalculatorCloseState] = useState<CurrencyFieldCalculatorState>({
    requestId: 0,
    isClosedFromCalculator: false,
    isClosingFromRouteChange: false,
  });
  const { requestId, isClosedFromCalculator, isClosingFromRouteChange } = calculatorCloseState;
  const [state, actions] = useCalculatorMode({
    value: fieldProps.value ?? 0,
    onChange: (value) => fieldProps.onChange?.(value),
    currency: fieldProps.currency,
  });
  const calculatorFieldId =
    calculatorId ?? configuredPresenceElementId ?? fieldProps.name ?? "currency";
  const isRouteControlled =
    activeCalculatorId !== undefined ||
    onOpenCalculator !== undefined ||
    onCloseCalculator !== undefined;
  const isCalculatorRouteActive = isRouteControlled && activeCalculatorId === calculatorFieldId;
  const isRouteClosePending =
    isRouteControlled &&
    activeCalculatorId === undefined &&
    state.isActive &&
    !isClosedFromCalculator;
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
  const fieldLabel = getCalculatorFieldLabel(fieldProps);

  useEffect(() => {
    if (!isRouteControlled) {
      return;
    }

    if (activeCalculatorId === calculatorFieldId) {
      pendingRouteOpenCalculatorIdRef.current = null;
      if (state.isActive || isClosedFromCalculator || isClosingFromCalculatorRef.current) {
        return;
      }

      isClosingFromCalculatorRef.current = false;
      setCalculatorPresenceElementId(
        configuredPresenceElementId ?? getPresenceElementIdFromTarget(fieldContainerRef.current),
      );
      actions.activate({ selectAll: true });
      return;
    }

    if (activeCalculatorId !== calculatorFieldId && state.isActive) {
      if (activeCalculatorId === undefined) {
        if (pendingRouteOpenCalculatorIdRef.current === calculatorFieldId) {
          return;
        }

        if (isClosingFromCalculatorRef.current) {
          blurFocusedCalculatorField();
          actions.deactivate();
          setCalculatorCloseState((currentState) => ({
            ...currentState,
            isClosedFromCalculator: true,
            isClosingFromRouteChange: false,
          }));
        } else if (!isClosingFromRouteChange) {
          suppressCalculatorAutoOpen();
          blurFocusedCalculatorField();
          window.requestAnimationFrame(blurFocusedCalculatorField);
          setCalculatorCloseState((currentState) => ({
            requestId: currentState.requestId + 1,
            isClosedFromCalculator: false,
            isClosingFromRouteChange: true,
          }));
        }
        return;
      }

      pendingRouteOpenCalculatorIdRef.current = null;
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
    isClosedFromCalculator,
    isClosingFromRouteChange,
    isRouteControlled,
    state.isActive,
  ]);

  function clearScheduledOpenCalculator() {
    if (scheduledOpenTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(scheduledOpenTimeoutRef.current);
    scheduledOpenTimeoutRef.current = null;
  }

  function openCalculator() {
    clearScheduledOpenCalculator();
    pendingRouteOpenCalculatorIdRef.current = calculatorFieldId;
    setCalculatorPresenceElementId(
      configuredPresenceElementId ?? getPresenceElementIdFromTarget(fieldContainerRef.current),
    );
    isClosingFromCalculatorRef.current = false;
    setCalculatorCloseState((currentState) => ({
      ...currentState,
      isClosedFromCalculator: false,
      isClosingFromRouteChange: false,
    }));
    actions.activate({ selectAll: true });
    onOpenCalculator?.(calculatorFieldId);
  }

  function requestCloseCalculator() {
    setCalculatorCloseState((currentState) => ({
      ...currentState,
      requestId: currentState.requestId + 1,
    }));
  }

  function closeCalculator({ suppressAutoOpen = false }: { suppressAutoOpen?: boolean } = {}) {
    const shouldCloseRoute = !isClosingFromRouteChange;
    pendingRouteOpenCalculatorIdRef.current = null;
    if (shouldCloseRoute) {
      isClosingFromCalculatorRef.current = true;
    }
    if (suppressAutoOpen) {
      suppressCalculatorAutoOpen();
    }
    setCalculatorCloseState((currentState) => ({
      ...currentState,
      isClosedFromCalculator: shouldCloseRoute || currentState.isClosedFromCalculator,
      isClosingFromRouteChange: false,
    }));
    blurFocusedCalculatorField();
    actions.deactivate();
    window.requestAnimationFrame(blurFocusedCalculatorField);
    if (shouldCloseRoute) {
      const closeRouteCalculator = onCloseCalculator;
      window.requestAnimationFrame(() => closeRouteCalculator?.());
    }
  }

  function commitCalculator() {
    actions.commit();
    closeCalculator({ suppressAutoOpen: true });
  }

  function dismissCalculator() {
    closeCalculator({ suppressAutoOpen: true });
  }

  function handleFocus(event: React.FocusEvent<HTMLInputElement>) {
    fieldProps.onFocus?.(event);

    if (
      autoOpenCalculator &&
      !isCalculatorActive &&
      !wasRecentCalculatorButtonInteraction() &&
      !isCalculatorAutoOpenSuppressed()
    ) {
      openCalculator();
    }
  }

  function allowCalculatorAutoOpenFromUserInteraction() {
    if (autoOpenCalculator) {
      allowCalculatorAutoOpenForUserInteraction();
    }
  }

  function openCalculatorFromUserInteraction() {
    if (!autoOpenCalculator) {
      return;
    }

    allowCalculatorAutoOpenFromUserInteraction();

    const hasActiveCalculatorRoute = new URLSearchParams(window.location.search).has("calculator");
    if (
      isRouteControlled &&
      !hasActiveCalculatorRoute &&
      !isCalculatorActive &&
      !isCalculatorAutoOpenSuppressed()
    ) {
      openCalculator();
    } else if (!isRouteControlled && !isCalculatorActive && !isCalculatorAutoOpenSuppressed()) {
      openCalculator();
    }
  }

  function scheduleOpenCalculatorFromUserInteraction() {
    allowCalculatorAutoOpenFromUserInteraction();
    clearScheduledOpenCalculator();
    scheduledOpenTimeoutRef.current = window.setTimeout(() => {
      scheduledOpenTimeoutRef.current = null;
      openCalculatorFromUserInteraction();
    }, 0);
  }

  function wasRecentCalculatorButtonInteraction() {
    const lastInteractionTime = lastCalculatorButtonInteractionTimeRef.current;

    if (lastInteractionTime === null) {
      return false;
    }

    return performance.now() - lastInteractionTime < CALCULATOR_BUTTON_FOCUS_IGNORE_MS;
  }

  function shouldIgnoreAutoOpenFromTarget(target: EventTarget | null) {
    if (!isCalculatorFieldButtonTarget(target)) {
      return false;
    }

    lastCalculatorButtonInteractionTimeRef.current = performance.now();
    clearScheduledOpenCalculator();
    return true;
  }

  function handlePointerDownCapture(event: React.PointerEvent<HTMLDivElement>) {
    if (shouldIgnoreAutoOpenFromTarget(event.target)) {
      onPointerDownCapture?.(event);
      return;
    }

    if (fieldContainerRef.current?.contains(event.target as Node)) {
      scheduleOpenCalculatorFromUserInteraction();
    }
    onPointerDownCapture?.(event);
  }

  function handleMouseDownCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (shouldIgnoreAutoOpenFromTarget(event.target)) {
      onMouseDownCapture?.(event);
      return;
    }

    if (fieldContainerRef.current?.contains(event.target as Node)) {
      scheduleOpenCalculatorFromUserInteraction();
    }
    onMouseDownCapture?.(event);
  }

  useEffect(() => {
    const fieldContainer = fieldContainerRef.current;
    if (!fieldContainer) {
      return;
    }

    function handleNativePointerStart(event: PointerEvent | MouseEvent) {
      if (shouldIgnoreAutoOpenFromTarget(event.target)) {
        return;
      }

      scheduleOpenCalculatorFromUserInteraction();
    }

    fieldContainer.addEventListener("pointerdown", handleNativePointerStart, { capture: true });
    fieldContainer.addEventListener("mousedown", handleNativePointerStart, { capture: true });

    return () => {
      fieldContainer.removeEventListener("pointerdown", handleNativePointerStart, {
        capture: true,
      });
      fieldContainer.removeEventListener("mousedown", handleNativePointerStart, { capture: true });
    };
  });

  useEffect(() => clearScheduledOpenCalculator, []);

  return {
    actions,
    calculatorPresenceElementId,
    commitCalculator,
    configuredPresenceElementId,
    dismissCalculator,
    fieldContainerRef,
    fieldLabel,
    handleFocus,
    handleMouseDownCapture,
    handlePointerDownCapture,
    isCalculatorActive,
    openCalculator,
    requestCloseCalculator,
    requestId,
    shouldPreventNativeKeyboard,
    shouldRenderCalculator,
    state,
  };
}
/* eslint-enable react-doctor/no-adjust-state-on-prop-change, react-doctor/no-cascading-set-state, react-doctor/no-chain-state-updates, react-doctor/no-event-handler */

function CalculatorFieldButton({
  configuredPresenceElementId,
  isCalculatorActive,
  onOpenCalculator,
  onRequestCloseCalculator,
  className,
}: {
  configuredPresenceElementId?: string;
  isCalculatorActive: boolean;
  onOpenCalculator: () => void;
  onRequestCloseCalculator: () => void;
  className?: string;
}) {
  return (
    <IconButton
      icon={isCalculatorActive ? "lucide.x" : "lucide.calculator"}
      aria-label={isCalculatorActive ? t`Close calculator` : t`Open calculator`}
      color="transparent"
      data-calculator-field-button=""
      data-presence-proxy-element-id={configuredPresenceElementId}
      className={className ?? "absolute top-1/2 right-1 h-8 w-8 -translate-y-1/2"}
      iconClassName="size-4"
      onPress={isCalculatorActive ? onRequestCloseCalculator : onOpenCalculator}
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
  onPointerDownCapture,
  onMouseDownCapture,
  ...props
}: CurrencyFieldWithCalculatorProps) {
  const {
    actions,
    calculatorPresenceElementId,
    commitCalculator,
    configuredPresenceElementId,
    dismissCalculator,
    fieldContainerRef,
    fieldLabel,
    handleFocus,
    handleMouseDownCapture,
    handlePointerDownCapture,
    isCalculatorActive,
    openCalculator,
    requestCloseCalculator,
    requestId,
    shouldPreventNativeKeyboard,
    shouldRenderCalculator,
    state,
  } = useCurrencyFieldCalculator({
    activeCalculatorId,
    autoOpenCalculator,
    calculatorId,
    fieldProps: props,
    onCloseCalculator,
    onMouseDownCapture,
    onOpenCalculator,
    onPointerDownCapture,
  });

  return (
    <div
      ref={fieldContainerRef}
      onPointerDownCapture={handlePointerDownCapture}
      onMouseDownCapture={handleMouseDownCapture}
    >
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
        inputEndAdornment={
          <CalculatorFieldButton
            configuredPresenceElementId={configuredPresenceElementId}
            isCalculatorActive={isCalculatorActive}
            onOpenCalculator={openCalculator}
            onRequestCloseCalculator={requestCloseCalculator}
            className={calculatorButtonClassName}
          />
        }
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
          onDismiss={dismissCalculator}
          closeRequestId={requestId}
          attachmentPhotoIds={calculatorAttachmentPhotoIds}
          fieldContainerRef={fieldContainerRef}
          presenceElementId={calculatorPresenceElementId ?? configuredPresenceElementId}
          previewValue={state.previewValue}
          currency={props.currency}
          dismissOnOutsideInteraction
          fieldLabel={fieldLabel}
        />
      )}
    </div>
  );
}
