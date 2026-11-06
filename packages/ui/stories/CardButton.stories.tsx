import type { Meta, StoryObj } from "@storybook/react-vite";
import { CardButton } from "@trizum/ui/CardButton";

const meta = {
  title: "Components/CardButton",
  component: CardButton,
  parameters: {
    docs: {
      description: { component: "Card-shaped action with hover, focus, and pressed feedback." },
    },
  },
} satisfies Meta<typeof CardButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { children: "Open details" } };
export const Disabled: Story = { args: { children: "Unavailable", isDisabled: true } };
