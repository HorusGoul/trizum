import type { Meta, StoryObj } from "@storybook/react-vite";
import { Skeleton } from "@trizum/ui/Skeleton";

const meta = {
  title: "Components/Skeleton",
  component: Skeleton,
  parameters: {
    docs: {
      description: {
        component:
          "Loading placeholder; pair it with an accessible loading announcement in the consumer.",
      },
    },
  },
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { className: "h-6 w-48" } };
export const Card: Story = { args: { className: "h-32 w-full rounded-xl" } };
