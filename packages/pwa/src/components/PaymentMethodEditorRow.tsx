import { Trans, useLingui } from "@lingui/react/macro";
import { IconButton } from "@trizum/ui/IconButton";
import { Menu, MenuItem } from "@trizum/ui/Menu";
import {
  ModalSheet,
  ModalSheetAction,
  ModalSheetActions,
  ModalSheetContent,
  ModalSheetHeader,
  ModalSheetSection,
  ModalSheetTitle,
} from "@trizum/ui/ModalSheet";
import { Input, TextArea, TextField } from "@trizum/ui/fields/TextField";
import { useMediaQuery } from "@trizum/ui/useMediaQuery";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { mergeProps, useButton, useLongPress } from "react-aria";
import { MenuTrigger, Text } from "react-aria-components";
import { Popover } from "@trizum/ui/Popover";
import { useCopyPaymentDetails } from "#src/hooks/useCopyPaymentDetails.ts";
import { trackEvent } from "#src/lib/analytics.ts";
import {
  getPaymentLink,
  paymentMethodDescriptions,
  paymentMethodLabels,
  paymentMethodPlaceholders,
  validatePaymentMethod,
} from "#src/lib/paymentMethods.ts";
import type { PaymentMethodType } from "#src/models/paymentMethod.ts";
import { PaymentMethodIcon } from "./PaymentMethodIcon.tsx";
import { PaymentMethodPopoverContent } from "./PaymentMethodPopoverContent.tsx";

export function PaymentMethodEditorRow({
  type,
  details,
  onChange,
  onRemove,
}: {
  type: PaymentMethodType;
  details: string;
  onChange: (details: string) => void;
  onRemove: () => void;
}) {
  const { t } = useLingui();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(!details);
  const editAfterClose = useRef(false);
  const actionRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const detailsId = useId();
  const hintId = useId();
  const errorId = useId();

  const { buttonProps } = useButton(
    { onPress: () => (details.trim() ? setIsOpen(true) : setIsEditing(true)) },
    actionRef,
  );

  const methodName = t(paymentMethodLabels[type]);
  const editLabel = t({ message: `Edit ${methodName}` });
  const href = getPaymentLink(type, details);
  const copyDetails = useCopyPaymentDetails(details);
  const error = isEditing ? null : validatePaymentMethod(type, details);

  const { longPressProps } = useLongPress({
    accessibilityDescription: t`Hold for payment method actions`,
    onLongPress: () => setIsOpen(true),
  });

  const fieldClassName =
    "min-h-12 w-full border-0 bg-transparent px-0 py-3 text-base font-medium shadow-none outline-none placeholder:font-normal placeholder:italic placeholder:text-accent-950/60 dark:bg-transparent dark:placeholder:text-accent-50/55 data-[focused]:ring-0 data-[focused]:ring-offset-0";

  const hintClassName =
    "text-accent-600 dark:text-accent-400 sr-only text-xs md:not-sr-only md:block md:pb-3";

  const serviceLabel = (
    <span className="text-accent-700 dark:text-accent-200 flex min-h-12 w-5 shrink-0 items-center justify-center self-start md:w-28 md:justify-start md:gap-2">
      <PaymentMethodIcon type={type} size={20} />
      <span className="hidden text-sm font-medium md:block">{methodName}</span>
    </span>
  );

  useLayoutEffect(() => {
    if (isEditing) {
      fieldRef.current
        ?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea")
        ?.focus();
    }
  }, [isEditing]);

  function editDetails() {
    editAfterClose.current = true;
    setIsOpen(false);
  }

  function finishClosingActions() {
    if (editAfterClose.current) {
      editAfterClose.current = false;
      setIsEditing(true);
    }
  }

  function previewLink() {
    if (!href) return;
    trackEvent("payment_link_requested");
    window.open(href, "_blank", "noopener,noreferrer");
    setIsOpen(false);
  }

  return (
    <div className="group dark:bg-accent-900 focus-within:ring-accent-400 relative bg-white first:rounded-t-xl last:rounded-b-xl focus-within:z-10 focus-within:ring-2 focus-within:ring-inset">
      {isEditing ? (
        <div className="flex items-start gap-3 px-4 md:pr-17">
          {serviceLabel}
          <TextField
            ref={fieldRef}
            aria-label={methodName}
            name={`paymentMethods.${type}`}
            value={details}
            onChange={onChange}
            onBlur={() => setIsEditing(false)}
            maxLength={type === "bizum" ? 20 : 1000}
            className="min-w-0 flex-1"
          >
            {type === "other" || type === "bank-transfer" ? (
              <TextArea
                rows={1}
                placeholder={t(paymentMethodPlaceholders[type])}
                autoCapitalize="none"
                autoCorrect="off"
                className={`${fieldClassName} field-sizing-content max-h-40 resize-y`}
              />
            ) : (
              <Input
                type={type === "bizum" ? "tel" : "text"}
                placeholder={t(paymentMethodPlaceholders[type])}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={fieldClassName}
              />
            )}
            <Text slot="description" className={hintClassName}>
              {t(paymentMethodDescriptions[type])}
            </Text>
          </TextField>
        </div>
      ) : (
        <button
          {...mergeProps(buttonProps, longPressProps)}
          ref={actionRef}
          aria-label={details.trim() ? t({ message: `${methodName} actions` }) : editLabel}
          aria-describedby={[
            detailsId,
            hintId,
            error ? errorId : null,
            longPressProps["aria-describedby"],
          ]
            .filter(Boolean)
            .join(" ")}
          className="flex w-full cursor-pointer touch-pan-y items-start gap-3 px-4 text-left outline-hidden select-none [-webkit-touch-callout:none] md:pr-17"
        >
          {serviceLabel}
          <span className="min-w-0 flex-1">
            <span
              id={detailsId}
              className={`block min-h-12 truncate py-3 text-base ${details.trim() ? "font-medium" : "text-accent-950/60 dark:text-accent-50/55 italic"}`}
            >
              {details.trim() ? details : t(paymentMethodPlaceholders[type])}
            </span>
            <span id={hintId} className={hintClassName}>
              {t(paymentMethodDescriptions[type])}
            </span>
            {error ? (
              <span id={errorId} className="text-danger-500 block pb-2 text-sm font-medium">
                {error}
              </span>
            ) : null}
          </span>
        </button>
      )}
      {isDesktop ? (
        <MenuTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
          <IconButton
            icon="lucide.ellipsis"
            aria-label={t({ message: `More ${methodName} actions` })}
            className="text-accent-700 dark:text-accent-200 absolute top-0.5 right-3 size-11 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
          />
          <Popover placement="bottom end">
            <PaymentMethodPopoverContent onClose={finishClosingActions}>
              <Menu aria-label={t({ message: `${methodName} actions` })}>
                <MenuItem onAction={editDetails}>
                  <Trans>Edit</Trans>
                </MenuItem>
                {href ? (
                  <MenuItem onAction={previewLink}>
                    <Trans>Preview payment link</Trans>
                  </MenuItem>
                ) : null}
                <MenuItem isDisabled={!details.trim()} menuAction={copyDetails}>
                  <Trans>Copy details</Trans>
                </MenuItem>
                <MenuItem className="text-rose-700 dark:text-rose-300" onAction={onRemove}>
                  <Trans>Remove payment method</Trans>
                </MenuItem>
              </Menu>
            </PaymentMethodPopoverContent>
          </Popover>
        </MenuTrigger>
      ) : null}
      {!isDesktop ? (
        <ModalSheet isOpen={isOpen} onOpenChange={setIsOpen} onCloseEnd={finishClosingActions}>
          <ModalSheetHeader>
            <ModalSheetSection>
              <ModalSheetTitle>{methodName}</ModalSheetTitle>
            </ModalSheetSection>
          </ModalSheetHeader>
          <ModalSheetContent>
            <ModalSheetActions>
              <ModalSheetAction icon="lucide.pencil" onPress={editDetails}>
                <Trans>Edit</Trans>
              </ModalSheetAction>
              {href ? (
                <ModalSheetAction icon="lucide.arrow-up-right" onPress={previewLink}>
                  <Trans>Preview payment link</Trans>
                </ModalSheetAction>
              ) : null}
              <ModalSheetAction
                icon="lucide.copy"
                isDisabled={!details.trim()}
                onPress={() => {
                  void copyDetails();
                  setIsOpen(false);
                }}
              >
                <Trans>Copy details</Trans>
              </ModalSheetAction>
              <ModalSheetAction
                icon="lucide.trash-2"
                tone="danger"
                onPress={() => {
                  setIsOpen(false);
                  onRemove();
                }}
              >
                <Trans>Remove payment method</Trans>
              </ModalSheetAction>
            </ModalSheetActions>
          </ModalSheetContent>
        </ModalSheet>
      ) : null}
    </div>
  );
}
