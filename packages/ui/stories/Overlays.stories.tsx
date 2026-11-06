import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "@trizum/ui/Button";
import { Tooltip, TooltipTrigger } from "@trizum/ui/Tooltip";
import { Popover, PopoverDialog, PopoverTrigger } from "@trizum/ui/Popover";
import {
  ModalSheet,
  ModalSheetHeader,
  ModalSheetTitle,
  ModalSheetDescription,
  ModalSheetContent,
  ModalSheetSection,
  ModalSheetActions,
  ModalSheetAction,
} from "@trizum/ui/ModalSheet";

const meta = {
  title: "Components/Overlays",
  parameters: {
    docs: {
      description: {
        component:
          "Popover and Tooltip use React Aria triggers. ModalSheet composes a header, title, description, and explicit close button. Drag or Escape dismisses the default sheet.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const Help: Story = {
  render: () => (
    <TooltipTrigger delay={0}>
      <Button>Hover or focus</Button>
      <Tooltip>Additional information</Tooltip>
    </TooltipTrigger>
  ),
};

export const Details: Story = {
  render: () => (
    <PopoverTrigger>
      <Button>Open details</Button>
      <Popover>
        <PopoverDialog aria-label="Details">Popover content</PopoverDialog>
      </Popover>
    </PopoverTrigger>
  ),
};

function SheetExample({ isDismissable = true }: { isDismissable?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onPress={() => setOpen(true)}>Open sheet</Button>
      <ModalSheet isOpen={open} onOpenChange={setOpen} isDismissable={isDismissable}>
        <ModalSheetHeader>
          <ModalSheetTitle>Sheet title</ModalSheetTitle>
          <ModalSheetDescription>Supporting details</ModalSheetDescription>
        </ModalSheetHeader>
        <ModalSheetContent>
          <ModalSheetSection>Sheet content</ModalSheetSection>
          <ModalSheetActions>
            <ModalSheetAction icon="lucide.check" onPress={() => setOpen(false)}>
              Done
            </ModalSheetAction>
            <ModalSheetAction icon="lucide.trash" tone="danger" onPress={() => setOpen(false)}>
              Remove
            </ModalSheetAction>
          </ModalSheetActions>
        </ModalSheetContent>
      </ModalSheet>
    </>
  );
}

export const Sheet: Story = { render: () => <SheetExample /> };
export const NonDismissableSheet: Story = { render: () => <SheetExample isDismissable={false} /> };
