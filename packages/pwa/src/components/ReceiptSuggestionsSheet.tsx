import { Trans, useLingui } from "@lingui/react/macro";
import { useState } from "react";
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
import type { ReceiptDraftValues } from "#src/lib/receiptSuggestions.ts";

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
            <Checkbox isSelected={useTitle} onChange={setUseTitle}>
              <span className="flex flex-col gap-1">
                <span className="text-sm">
                  <Trans>Title</Trans>
                </span>
                <span className="font-semibold">{suggestions.name}</span>
              </span>
            </Checkbox>
          ) : null}
          {suggestions.amount !== undefined ? (
            <Checkbox isSelected={useTotal} onChange={setUseTotal}>
              <span className="flex flex-col gap-1">
                <span className="text-sm">
                  <Trans>Total, including tax and discounts</Trans>
                </span>
                <span className="font-semibold">
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
          <p className="text-accent-600 dark:text-accent-400 text-xs">
            <Trans>Suggestions can contain mistakes. Check them against your receipt.</Trans>
          </p>
          <Button
            color="accent"
            isDisabled={!hasSelection}
            onPress={() => {
              const values: Partial<ReceiptDraftValues> = {};

              if (useTitle && suggestions.name !== undefined) values.name = suggestions.name;

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
