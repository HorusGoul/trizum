import { Trans, useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { Radio, RadioGroup } from "react-aria-components";
import { Button } from "@trizum/ui/Button";
import { Checkbox } from "@trizum/ui/Checkbox";
import { Icon } from "@trizum/ui/Icon";
import {
  ModalSheet,
  ModalSheetContent,
  ModalSheetDescription,
  ModalSheetHeader,
  ModalSheetSection,
  ModalSheetTitle,
} from "@trizum/ui/ModalSheet";
import type { Receipt } from "#src/lib/api/receiptContract.ts";
import { getReceiptTitleOptions, type ReceiptDraftValues } from "#src/lib/receiptSuggestions.ts";

const suggestionRowClassName =
  "w-full min-h-20 flex-row-reverse justify-between gap-4 rounded-[1.35rem] px-4 py-4 text-left data-[selected]:bg-accent-100 dark:data-[selected]:bg-accent-900 data-[hovered]:bg-accent-100 dark:data-[hovered]:bg-accent-900";

export function ReceiptSuggestionsSheet({
  receipt,
  suggestions,
  onAccept,
  onDiscard,
}: {
  receipt: Receipt;
  suggestions: { name?: string; amount?: number; currencyMismatch: boolean };
  onAccept: (values: Partial<ReceiptDraftValues>) => void;
  onDiscard: () => void;
}) {
  const { t } = useLingui();
  const [useTitle, setUseTitle] = useState(true);
  const [useTotal, setUseTotal] = useState(true);
  const [selectedTitle, setSelectedTitle] = useState(suggestions.name);
  const titleOptions = getReceiptTitleOptions(receipt);

  const hasSelection =
    (useTitle && suggestions.name !== undefined) || (useTotal && suggestions.amount !== undefined);

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
          <div className="text-accent-950 dark:text-accent-50 flex items-center gap-2">
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
        <ModalSheetSection className="flex flex-col gap-4 py-4">
          {suggestions.name !== undefined ? (
            <div className="min-w-0">
              <Checkbox
                className={suggestionRowClassName}
                isSelected={useTitle}
                onChange={setUseTitle}
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-accent-700 dark:text-accent-300 text-sm font-normal">
                    <Trans>Title</Trans>
                  </span>
                  <span className="text-accent-950 dark:text-accent-50 text-lg font-semibold break-words">
                    {selectedTitle}
                  </span>
                </span>
              </Checkbox>
              {titleOptions.length > 1 ? (
                <RadioGroup
                  aria-label={t`Title`}
                  orientation="horizontal"
                  value={selectedTitle}
                  onChange={(title) => {
                    setSelectedTitle(title);
                    setUseTitle(true);
                  }}
                  className="no-scrollbar mt-2 flex gap-2 overflow-x-auto overscroll-x-contain p-1"
                >
                  {titleOptions.map((title) => (
                    <Radio
                      key={title}
                      value={title}
                      className="border-accent-300 text-accent-700 dark:border-accent-700 dark:text-accent-200 data-[selected]:border-accent-500 data-[selected]:bg-accent-200 data-[selected]:text-accent-950 dark:data-[selected]:bg-accent-800 dark:data-[selected]:text-accent-50 data-[focus-visible]:outline-accent-500 relative flex min-h-11 shrink-0 cursor-pointer items-center rounded-full border px-4 text-sm select-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2"
                    >
                      {title}
                    </Radio>
                  ))}
                </RadioGroup>
              ) : null}
            </div>
          ) : null}
          {suggestions.amount !== undefined ? (
            <Checkbox
              className={suggestionRowClassName}
              isSelected={useTotal}
              onChange={setUseTotal}
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-accent-700 dark:text-accent-300 text-sm font-normal">
                  <Trans>Total, including tax and discounts</Trans>
                </span>
                <span className="text-accent-950 dark:text-accent-50 text-lg font-semibold">
                  {receipt.total} {receipt.currency}
                </span>
              </span>
            </Checkbox>
          ) : null}
          {suggestions.currencyMismatch ? (
            <p className="text-accent-700 dark:text-accent-300 text-sm">
              <Trans>
                The receipt currency differs from this party’s currency. The total cannot be
                applied.
              </Trans>{" "}
              <span className="font-semibold">
                {receipt.total} {receipt.currency}
              </span>
            </p>
          ) : null}
          {suggestions.name === undefined && suggestions.amount === undefined ? (
            <p className="text-accent-700 dark:text-accent-300 text-sm">
              <Trans>No new title or total could be suggested. Your edits are kept.</Trans>
            </p>
          ) : null}
          <Button
            color="accent"
            isDisabled={!hasSelection}
            onPress={() => {
              const values: Partial<ReceiptDraftValues> = {};

              if (useTitle && suggestions.name !== undefined) values.name = selectedTitle;

              if (useTotal && suggestions.amount !== undefined) values.amount = suggestions.amount;
              onAccept(values);
            }}
          >
            <Trans>Accept suggestions</Trans>
          </Button>
          <Button color="input-like" onPress={onDiscard}>
            <Trans>Discard</Trans>
          </Button>
        </ModalSheetSection>
      </ModalSheetContent>
    </ModalSheet>
  );
}
