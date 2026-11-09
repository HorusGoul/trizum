import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@trizum/ui/Button";
import { Icon } from "@trizum/ui/Icon";
import {
  ModalSheet,
  ModalSheetContent,
  ModalSheetHeader,
  ModalSheetSection,
  ModalSheetTitle,
} from "@trizum/ui/ModalSheet";
import { SelectItem } from "@trizum/ui/Select";
import { Menu, MenuItem } from "@trizum/ui/Menu";
import { Popover } from "@trizum/ui/Popover";
import { useMediaQuery } from "@trizum/ui/useMediaQuery";
import { useRef, useState } from "react";
import { ListBox, MenuTrigger } from "react-aria-components";
import { paymentMethodLabels } from "#src/lib/paymentMethods.ts";
import {
  paymentMethodTypes,
  type PaymentMethods,
  type PaymentMethodType,
} from "#src/models/paymentMethod.ts";
import { PaymentMethodIcon } from "./PaymentMethodIcon.tsx";
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

    const content = (
      <span className="flex min-h-9 items-center gap-3 md:min-h-0">
        <PaymentMethodIcon type={type} size={20} />
        {methodName}
      </span>
    );

    return isDesktop ? (
      <MenuItem key={type} id={type} textValue={methodName} onAction={() => addMethod(type)}>
        {content}
      </MenuItem>
    ) : (
      <SelectItem key={type} id={type} textValue={methodName} className="px-0 py-2">
        {content}
      </SelectItem>
    );
  });

  return (
    <section className="border-accent-200 dark:border-accent-800 flex flex-col gap-4 border-y py-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">
          <Trans>Get paid</Trans>
        </h2>
        <p className="text-accent-700 dark:text-accent-300 text-sm">
          <Trans>Shared with everyone in your groups.</Trans>
        </p>
      </div>
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
      {available.length > 0 ? (
        isDesktop ? (
          <MenuTrigger isOpen={isPickerOpen} onOpenChange={setIsPickerOpen}>
            <Button color="transparent" className="min-h-11 justify-start gap-2">
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
              color="transparent"
              className="min-h-11 justify-start gap-2"
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
                <ModalSheetSection>
                  <ListBox
                    aria-label={t`Payment methods`}
                    onAction={(key) => {
                      const type = available.find((type) => type === key);

                      if (type) addMethod(type);
                    }}
                  >
                    {options}
                  </ListBox>
                </ModalSheetSection>
              </ModalSheetContent>
            </ModalSheet>
          </>
        )
      ) : null}
    </section>
  );
}
