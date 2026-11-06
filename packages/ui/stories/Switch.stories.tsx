import type { Meta, StoryObj } from "@storybook/react-vite";
import { Switch } from "@trizum/ui/Switch";

const meta = {
  title: "Components/Switch",
  component: Switch,
  parameters: {
    docs: {
      description: { component: "Accessible switch; use changeAction for async changes." },
    },
  },
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { children: "Enable notifications" } };

export const Selected: Story = {
  args: { children: "Enable notifications", defaultSelected: true },
};

export const Disabled: Story = { args: { children: "Enable notifications", isDisabled: true } };
