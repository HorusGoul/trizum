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

export function OnlyUseCustomTemplatesSheet({
  isOpen,
  onConfirm,
  onOpenChange,
  templateName,
}: {
  isOpen: boolean;
  onConfirm: () => void;
  onOpenChange: (isOpen: boolean) => void;
  templateName: string;
}) {
  return (
    <ModalSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalSheetHeader>
        <ModalSheetSection>
          <ModalSheetTitle>
            <Trans>Only use custom templates?</Trans>
          </ModalSheetTitle>
        </ModalSheetSection>
      </ModalSheetHeader>
      <ModalSheetContent>
        <ModalSheetSection className="text-accent-700 dark:text-accent-200 pb-3 text-sm">
          <Trans>
            {templateName} will become the default. New expenses will always start from a custom
            template.
          </Trans>
        </ModalSheetSection>
        <ModalSheetActions>
          <ModalSheetAction icon="lucide.layout-template" onPress={onConfirm}>
            <Trans>Use custom templates only</Trans>
          </ModalSheetAction>
          <ModalSheetAction icon="lucide.x" onPress={() => onOpenChange(false)}>
            <Trans>Cancel</Trans>
          </ModalSheetAction>
        </ModalSheetActions>
      </ModalSheetContent>
    </ModalSheet>
  );
}
