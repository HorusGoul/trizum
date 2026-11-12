import { Trans, useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { Radio, RadioGroup } from "react-aria-components";
import { Button } from "@trizum/ui/Button";
import { Icon } from "@trizum/ui/Icon";
import {
  ModalSheet,
  ModalSheetChoice,
  ModalSheetChoices,
  ModalSheetContent,
  ModalSheetDescription,
  ModalSheetHeader,
  ModalSheetSection,
  ModalSheetTitle,
} from "@trizum/ui/ModalSheet";
import type { Receipt } from "#src/lib/api/receiptContract.ts";
import {
  getReceiptTitleOptions,
  hasReceiptSuggestions,
  type ReceiptDraftValues,
  type ReceiptSuggestions,
} from "#src/lib/receiptSuggestions.ts";

export function ReceiptSuggestionsSheet({
  receipt,
  suggestions,
  partyCurrency,
  onAccept,
  onDiscard,
}: {
  receipt: Receipt;
  suggestions: ReceiptSuggestions;
  partyCurrency: string;
  onAccept: (values: Partial<ReceiptDraftValues>) => void;
  onDiscard: () => void;
}) {
  const { t, i18n } = useLingui();
  const [useTitle, setUseTitle] = useState(true);
  const [useTotal, setUseTotal] = useState(true);
  const [useCurrency, setUseCurrency] = useState(true);
  const [selectedTitle, setSelectedTitle] = useState(suggestions.name);
  const titleOptions = getReceiptTitleOptions(receipt);
  const evidence = receipt.currencyEvidence;

  if (!hasReceiptSuggestions(suggestions)) return null;

  const totalEnabled =
    !suggestions.currencyMismatch || (suggestions.currency !== undefined && useCurrency);

  const currencyName = suggestions.currency
    ? new Intl.DisplayNames([i18n.locale], { type: "currency" }).of(suggestions.currency)
    : undefined;

  const hasSelection =
    (useTitle && suggestions.name !== undefined) ||
    (useTotal && totalEnabled && suggestions.amount !== undefined) ||
    (useCurrency && suggestions.currency !== undefined);

  return (
    <ModalSheet
      aria-label={t`Premium suggestions`}
      isOpen
      onOpenChange={(open) => {
        if (!open) onDiscard();
      }}
    >
      <ModalSheetHeader>
        <ModalSheetSection>
          <div className="text-accent-950 dark:text-accent-50 flex items-center gap-4">
            <Icon icon="lucide.sparkles" className="size-5" />
            <ModalSheetTitle>
              <Trans>Premium suggestions</Trans>
            </ModalSheetTitle>
          </div>
          <ModalSheetDescription className="mt-2">
            <Trans>Review the receipt details before applying them to your expense.</Trans>
          </ModalSheetDescription>
        </ModalSheetSection>
      </ModalSheetHeader>
      <ModalSheetContent>
        <div className="flex flex-col gap-2 py-2">
          {suggestions.name !== undefined ? (
            <div className="min-w-0">
              <ModalSheetChoices>
                <ModalSheetChoice
                  icon="lucide.type"
                  label={<Trans>Title</Trans>}
                  isSelected={useTitle}
                  onChange={setUseTitle}
                >
                  {selectedTitle}
                </ModalSheetChoice>
              </ModalSheetChoices>
              {titleOptions.length > 1 ? (
                <RadioGroup
                  aria-label={t`Title`}
                  orientation="horizontal"
                  value={selectedTitle}
                  onChange={(title) => {
                    setSelectedTitle(title);
                    setUseTitle(true);
                  }}
                  className="no-scrollbar px-safe-or-4 sm:px-safe-or-5 flex gap-1 overflow-x-auto overscroll-x-contain"
                >
                  {titleOptions.map((title) => (
                    <Radio
                      key={title}
                      value={title}
                      className="group/title relative flex min-h-11 shrink-0 cursor-pointer items-center outline-hidden select-none"
                    >
                      <span className="border-accent-300 text-accent-700 dark:border-accent-700 dark:text-accent-200 group-data-[selected]/title:border-accent-500 group-data-[selected]/title:bg-accent-200 group-data-[selected]/title:text-accent-950 dark:group-data-[selected]/title:bg-accent-800 dark:group-data-[selected]/title:text-accent-50 group-data-[focus-visible]/title:ring-accent-500 rounded-full border px-3 py-1 text-sm leading-5 group-data-[focus-visible]/title:ring-2 group-data-[focus-visible]/title:ring-offset-2">
                        {title}
                      </span>
                    </Radio>
                  ))}
                </RadioGroup>
              ) : null}
            </div>
          ) : null}
          {suggestions.currency !== undefined ? (
            <ModalSheetChoices>
              <ModalSheetChoice
                icon="lucide.coins"
                label={<Trans>Expense currency</Trans>}
                isSelected={useCurrency}
                onChange={setUseCurrency}
              >
                <span className="block">
                  {suggestions.currency} · {currencyName}
                </span>
                <span className="text-accent-700 dark:text-accent-300 mt-1 block text-sm font-normal">
                  {receipt.currencyEvidenceSource === "context" ? (
                    <Trans>
                      Currency inferred from {evidence}. Party currency: {partyCurrency}. Change
                      this expense only and review the exchange rate in the editor.
                    </Trans>
                  ) : (
                    <Trans>
                      Receipt shows {evidence}. Party currency: {partyCurrency}. Change this expense
                      only and review the exchange rate in the editor.
                    </Trans>
                  )}
                </span>
              </ModalSheetChoice>
            </ModalSheetChoices>
          ) : null}
          {suggestions.amount !== undefined ? (
            <ModalSheetChoices>
              <ModalSheetChoice
                icon="lucide.receipt-text"
                label={<Trans>Total</Trans>}
                isSelected={useTotal && totalEnabled}
                isDisabled={!totalEnabled}
                onChange={setUseTotal}
              >
                {receipt.total} {receipt.currency}
              </ModalSheetChoice>
            </ModalSheetChoices>
          ) : null}
          <ModalSheetSection className="flex flex-col gap-2 pt-2">
            {suggestions.currencyMismatch &&
            !totalEnabled &&
            receipt.total !== null &&
            (suggestions.currency === undefined || suggestions.amount !== undefined) ? (
              <p className="text-accent-700 dark:text-accent-300 text-sm">
                {suggestions.currency ? (
                  <Trans>Select the expense currency above to apply this total.</Trans>
                ) : (
                  <Trans>
                    The receipt currency differs from the selected expense currency. The total
                    cannot be applied.
                  </Trans>
                )}{" "}
                <span className="font-semibold">
                  {receipt.total} {receipt.currency}
                </span>
              </p>
            ) : null}
            <Button
              color="accent"
              isDisabled={!hasSelection}
              onPress={() => {
                const values: Partial<ReceiptDraftValues> = {};

                if (useTitle && suggestions.name !== undefined) values.name = selectedTitle;

                if (useCurrency && suggestions.currency !== undefined)
                  values.currency = suggestions.currency;

                if (useTotal && totalEnabled && suggestions.amount !== undefined)
                  values.amount = suggestions.amount;
                onAccept(values);
              }}
            >
              <Trans>Accept suggestions</Trans>
            </Button>
            <Button color="input-like" onPress={onDiscard}>
              <Trans>Discard</Trans>
            </Button>
          </ModalSheetSection>
        </div>
      </ModalSheetContent>
    </ModalSheet>
  );
}
