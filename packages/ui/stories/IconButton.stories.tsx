import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconButton } from "@trizum/ui/IconButton";

const meta = {
  title: "Components/IconButton",
  component: IconButton,
  parameters: {
    docs: {
      description: {
        component:
          "Always supply an accessible label. Icons come from the target-generated sprite.",
      },
    },
  },
} satisfies Meta<typeof IconButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { icon: "lucide.plus", "aria-label": "Add" } };

export const Accent: Story = {
  args: { icon: "lucide.plus", "aria-label": "Add", color: "accent" },
};

export const Pending: Story = {
  args: { icon: "lucide.plus", "aria-label": "Add", isPending: true },
};

export const Disabled: Story = {
  args: { icon: "lucide.plus", "aria-label": "Add", isDisabled: true },
};
