import { Trans } from "@lingui/react/macro";
import {
  ModalSheet,
  ModalSheetAction,
  ModalSheetActions,
  ModalSheetContent,
  ModalSheetHeader,
  ModalSheetSection,
  ModalSheetTitle,
} from "#src/ui/ModalSheet.tsx";

export function DeleteExpenseTemplateSheet({
  isOpen,
  onConfirm,
  onOpenChange,
}: {
  isOpen: boolean;
  onConfirm: () => void;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <ModalSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalSheetHeader>
        <ModalSheetSection>
          <ModalSheetTitle>
            <Trans>Delete expense template?</Trans>
          </ModalSheetTitle>
        </ModalSheetSection>
      </ModalSheetHeader>
      <ModalSheetContent>
        <ModalSheetSection className="text-accent-700 dark:text-accent-200 pb-3 text-sm">
          <Trans>
            This removes the template for everyone in the party. Existing expenses are not affected.
          </Trans>
        </ModalSheetSection>
        <ModalSheetActions>
          <ModalSheetAction icon="lucide.trash-2" tone="danger" onPress={onConfirm}>
            <Trans>Delete template</Trans>
          </ModalSheetAction>
          <ModalSheetAction icon="lucide.x" onPress={() => onOpenChange(false)}>
            <Trans>Cancel</Trans>
          </ModalSheetAction>
        </ModalSheetActions>
      </ModalSheetContent>
    </ModalSheet>
  );
}
