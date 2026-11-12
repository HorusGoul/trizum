import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@trizum/ui/Button";
import { Icon } from "@trizum/ui/Icon";
import {
  ModalSheet,
  ModalSheetAction,
  ModalSheetActions,
  ModalSheetContent,
  ModalSheetHeader,
  ModalSheetSection,
  ModalSheetTitle,
} from "@trizum/ui/ModalSheet";
import { Menu, MenuItem } from "@trizum/ui/Menu";
import { Popover } from "@trizum/ui/Popover";
import { useMediaQuery } from "@trizum/ui/useMediaQuery";
import { useRef, useState } from "react";
import { MenuTrigger } from "react-aria-components";
import { paymentMethodLabels } from "#src/lib/paymentMethods.ts";
import {
  paymentMethodTypes,
  type PaymentMethods,
  type PaymentMethodType,
} from "#src/models/paymentMethod.ts";
import { PaymentMethodIcon } from "./PaymentMethodIcon.tsx";
import { paymentMethodIcons } from "#src/lib/paymentMethodIcons.ts";
import { PaymentMethodEditorRow } from "./PaymentMethodEditorRow.tsx";
import { PaymentMethodPopoverContent } from "./PaymentMethodPopoverContent.tsx";

export function PaymentMethodsEditor({
  value,
  onChange,
}: {
  value: PaymentMethods;
  onChange: (value: PaymentMethods) => void;
}) {
  const { t } = useLingui();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const pendingMethod = useRef<PaymentMethodType | null>(null);
  const available = paymentMethodTypes.filter((type) => value[type] === undefined);
  const hasMethods = available.length < paymentMethodTypes.length;

  const addButtonClassName =
    "text-accent-950 dark:text-accent-50 min-h-11 w-auto self-start gap-2 rounded-xl px-4 font-medium";

  function addMethod(type: PaymentMethodType) {
    pendingMethod.current = type;
    setIsPickerOpen(false);
  }

  function finishAddingMethod() {
    const type = pendingMethod.current;

    if (type) {
      pendingMethod.current = null;
      onChange({ ...value, [type]: "" });
    }
  }

  const options = available.map((type) => {
    const methodName = t(paymentMethodLabels[type]);

    return (
      <MenuItem key={type} id={type} textValue={methodName} onAction={() => addMethod(type)}>
        <span className="flex items-center gap-3">
          <PaymentMethodIcon type={type} size={20} />
          {methodName}
        </span>
      </MenuItem>
    );
  });

  return (
    <section className="border-accent-200 dark:border-accent-800 flex flex-col gap-3 border-y py-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">
          <Trans>Get paid</Trans>
        </h2>
        <p className="text-accent-700 dark:text-accent-300 text-sm">
          <Trans>
            Your payment details are shared with people in your groups to help them settle debts
            with you.
          </Trans>
        </p>
      </div>
      {hasMethods ? (
        <div className="divide-accent-100 dark:divide-accent-800 divide-y">
          {paymentMethodTypes.map((type) => {
            const details = value[type];

            return details === undefined ? null : (
              <PaymentMethodEditorRow
                key={type}
                type={type}
                details={details}
                onChange={(details) => onChange({ ...value, [type]: details })}
                onRemove={() => {
                  const remaining = { ...value };
                  delete remaining[type];
                  onChange(remaining);
                }}
              />
            );
          })}
        </div>
      ) : null}
      {available.length > 0 ? (
        isDesktop ? (
          <MenuTrigger isOpen={isPickerOpen} onOpenChange={setIsPickerOpen}>
            <Button color="input-like" className={addButtonClassName}>
              <Icon icon="lucide.plus" width={18} height={18} />
              <Trans>Add payment method</Trans>
            </Button>
            <Popover placement="bottom start">
              <PaymentMethodPopoverContent onClose={finishAddingMethod}>
                <Menu aria-label={t`Payment methods`}>{options}</Menu>
              </PaymentMethodPopoverContent>
            </Popover>
          </MenuTrigger>
        ) : (
          <>
            <Button
              color="input-like"
              className={addButtonClassName}
              onPress={() => setIsPickerOpen(true)}
            >
              <Icon icon="lucide.plus" width={18} height={18} />
              <Trans>Add payment method</Trans>
            </Button>
            <ModalSheet
              isOpen={isPickerOpen}
              onOpenChange={setIsPickerOpen}
              onCloseEnd={finishAddingMethod}
            >
              <ModalSheetHeader>
                <ModalSheetSection>
                  <ModalSheetTitle>
                    <Trans>Add payment method</Trans>
                  </ModalSheetTitle>
                </ModalSheetSection>
              </ModalSheetHeader>
              <ModalSheetContent>
                <ModalSheetActions>
                  {available.map((type) => (
                    <ModalSheetAction
                      key={type}
                      icon={paymentMethodIcons[type]}
                      onPress={() => addMethod(type)}
                    >
                      {t(paymentMethodLabels[type])}
                    </ModalSheetAction>
                  ))}
                </ModalSheetActions>
              </ModalSheetContent>
            </ModalSheet>
          </>
        )
      ) : null}
    </section>
  );
}
