import type { Meta, StoryObj } from "@storybook/react-vite";
import { TrizumSpinner } from "@trizum/ui/TrizumSpinner";

const meta = {
  title: "Components/TrizumSpinner",
  component: TrizumSpinner,
  parameters: {
    docs: {
      description: {
        component:
          "Animated trizum mark. Shared styles include its animation and reduced-motion rules.",
      },
    },
  },
} satisfies Meta<typeof TrizumSpinner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { size: 48 } };
export const Small: Story = { args: { size: 24 } };
export const Large: Story = { args: { size: 96 } };
