import type { Meta, StoryObj } from "@storybook/react-vite";
import { SwitchField } from "@trizum/ui/SwitchField";

const meta = {
  title: "Components/SwitchField",
  component: SwitchField,
  parameters: {
    docs: { description: { component: "Switch with a visible label and optional description." } },
  },
} satisfies Meta<typeof SwitchField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { label: "Notifications", description: "Receive updates" } };
export const Selected: Story = { args: { label: "Notifications", defaultSelected: true } };
export const Disabled: Story = { args: { label: "Notifications", isDisabled: true } };
