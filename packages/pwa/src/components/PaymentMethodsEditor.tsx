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
import {
  Select,
  SelectItem,
  SelectListBox,
  SelectPopover,
  SelectTrigger,
  SelectValue,
} from "@trizum/ui/Select";
import { useMediaQuery } from "@trizum/ui/useMediaQuery";
import { useRef, useState } from "react";
import { ListBox } from "react-aria-components";
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

  const options = available.map((type) => (
    <SelectItem
      key={type}
      id={type}
      textValue={t(paymentMethodLabels[type])}
      className={isDesktop ? undefined : "px-0 py-2"}
    >
      <span className="flex min-h-9 items-center gap-3">
        <PaymentMethodIcon type={type} size={20} />
        {t(paymentMethodLabels[type])}
      </span>
    </SelectItem>
  ));

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
          <Select
            aria-label={t`Add payment method`}
            placeholder={t`Add payment method`}
            selectedKey={null}
            onSelectionChange={(key) => {
              const type = available.find((type) => type === key);

              if (type) addMethod(type);
            }}
          >
            <SelectTrigger className="border-accent-200 dark:border-accent-700 min-h-11 rounded-xl bg-transparent dark:bg-transparent">
              <span className="flex items-center gap-2">
                <Icon icon="lucide.plus" width={18} height={18} />
                <SelectValue className="data-[placeholder]:text-accent-700 dark:data-[placeholder]:text-accent-200" />
              </span>
            </SelectTrigger>
            <SelectPopover>
              <PaymentMethodPopoverContent onClose={finishAddingMethod}>
                <SelectListBox>{options}</SelectListBox>
              </PaymentMethodPopoverContent>
            </SelectPopover>
          </Select>
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
