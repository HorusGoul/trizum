import { Trans, useLingui } from "@lingui/react/macro";
import { IconButton } from "@trizum/ui/IconButton";
import { Menu, MenuItem } from "@trizum/ui/Menu";
import {
  ModalSheet,
  ModalSheetAction,
  ModalSheetActions,
  ModalSheetContent,
  ModalSheetHeader,
  ModalSheetTitle,
} from "@trizum/ui/ModalSheet";
import { Input, TextArea, TextField } from "@trizum/ui/fields/TextField";
import { FieldError } from "@trizum/ui/fields/Field";
import { useMediaQuery } from "@trizum/ui/useMediaQuery";
import { useRef, useState } from "react";
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
  const actionRef = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useButton({ onPress: () => setIsOpen(true) }, actionRef);
  const methodName = t(paymentMethodLabels[type]);
  const href = getPaymentLink(type, details);
  const copyDetails = useCopyPaymentDetails(details);
  const error = validatePaymentMethod(type, details);

  const { longPressProps } = useLongPress({
    accessibilityDescription: t`Hold for payment method actions`,
    onLongPress: () => setIsOpen(true),
  });

  const fieldClassName =
    "min-h-11 w-full border-0 bg-transparent px-0 py-3 text-base shadow-none outline-none placeholder:text-accent-500 dark:bg-transparent dark:placeholder:text-accent-400 data-[focused]:ring-0 data-[focused]:ring-offset-0";

  function previewLink() {
    if (!href) return;
    trackEvent("payment_link_requested");
    window.open(href, "_blank", "noopener,noreferrer");
    setIsOpen(false);
  }

  const menuItems = (
    <>
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
    </>
  );

  return (
    <div className="group dark:bg-accent-900 bg-white px-3 first:rounded-t-xl last:rounded-b-xl">
      <div className="focus-within:ring-accent-400 flex items-start gap-3 rounded-lg focus-within:ring-2">
        <button
          {...mergeProps(buttonProps, longPressProps)}
          ref={actionRef}
          aria-label={t({ message: `${methodName} actions` })}
          className="text-accent-700 dark:text-accent-200 focus-visible:ring-accent-500 flex min-h-12 w-11 shrink-0 touch-pan-y items-center justify-center self-start rounded-lg outline-hidden select-none [-webkit-touch-callout:none] focus-visible:ring-2 md:w-28 md:justify-start md:gap-2"
        >
          <PaymentMethodIcon type={type} size={20} />
          <span className="hidden text-sm font-medium md:block">{methodName}</span>
        </button>
        <TextField
          aria-label={methodName}
          name={`paymentMethods.${type}`}
          value={details}
          onChange={onChange}
          isRequired
          isInvalid={details.length > 0 && !!error}
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
          <Text
            slot="description"
            className="text-accent-600 dark:text-accent-400 sr-only text-xs md:not-sr-only md:hidden md:pb-3 md:group-focus-within:block"
          >
            {t(paymentMethodDescriptions[type])}
          </Text>
          <FieldError className="block pb-2">{error}</FieldError>
        </TextField>
        {isDesktop ? (
          <MenuTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
            <IconButton
              icon="lucide.ellipsis"
              aria-label={t({ message: `More ${methodName} actions` })}
              className="my-0.5 size-11 shrink-0 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
            />
            <Popover placement="bottom end">
              <Menu aria-label={t({ message: `${methodName} actions` })}>{menuItems}</Menu>
            </Popover>
          </MenuTrigger>
        ) : (
          <IconButton
            icon="lucide.ellipsis"
            aria-label={t({ message: `More ${methodName} actions` })}
            onPress={() => setIsOpen(true)}
            className="my-0.5 size-11 shrink-0"
          />
        )}
      </div>
      {!isDesktop ? (
        <ModalSheet isOpen={isOpen} onOpenChange={setIsOpen}>
          <ModalSheetHeader className="px-5">
            <ModalSheetTitle>{methodName}</ModalSheetTitle>
          </ModalSheetHeader>
          <ModalSheetContent>
            <ModalSheetActions>
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
