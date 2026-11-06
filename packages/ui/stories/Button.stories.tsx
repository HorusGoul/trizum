import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@trizum/ui/Button";

const meta = {
  title: "Components/Button",
  component: Button,
  parameters: {
    docs: {
      description: {
        component:
          "Full-width action button; pressAction handles async pending state automatically.",
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { children: "Continue" } };
export const Disabled: Story = { args: { children: "Continue", isDisabled: true } };
export const Pending: Story = { args: { children: "Saving", isPending: true } };
export const Transparent: Story = { args: { children: "Cancel", color: "transparent" } };
