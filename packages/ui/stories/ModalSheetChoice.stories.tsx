import type { Meta, StoryObj } from "@storybook/react-vite";
import { ModalSheetAction, ModalSheetChoice, ModalSheetChoices } from "@trizum/ui/ModalSheet";

const meta = {
  title: "Components/ModalSheetChoice",
  component: ModalSheetChoice,
  args: {
    icon: "lucide.type",
    label: "Title",
    children: "Cafetería",
    defaultSelected: true,
  },
  render: (args) => (
    <ModalSheetChoices>
      <ModalSheetChoice {...args} />
    </ModalSheetChoices>
  ),
  decorators: [
    (Story) => (
      <div className="w-full max-w-md">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "A sheet checkbox row with a leading icon, label, value, and the same press, hover, and focus feedback as sheet actions. ModalSheetChoices adds the inset gutter; the row padding keeps content aligned with standard sheet sections.",
      },
    },
  },
} satisfies Meta<typeof ModalSheetChoice>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Selected: Story = {};
export const Unselected: Story = { args: { defaultSelected: false } };
export const Disabled: Story = { args: { isDisabled: true } };

export const LongValue: Story = {
  args: { children: "Coffee and pastries at the neighbourhood café" },
};

export const AlongsideActions: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <ModalSheetChoices>
        <ModalSheetChoice icon="lucide.type" label="Title" defaultSelected>
          Cafetería
        </ModalSheetChoice>
        <ModalSheetChoice icon="lucide.receipt-text" label="Total" defaultSelected>
          15.70 EUR
        </ModalSheetChoice>
      </ModalSheetChoices>
      <ModalSheetAction icon="lucide.receipt-text">View receipt</ModalSheetAction>
      <ModalSheetAction icon="lucide.trash" tone="danger">
        Remove receipt
      </ModalSheetAction>
    </div>
  ),
};
