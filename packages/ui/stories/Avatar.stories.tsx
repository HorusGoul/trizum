import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "@trizum/ui/Avatar";

const meta = {
  title: "Components/Avatar",
  component: Avatar,
  parameters: {
    docs: {
      description: {
        component:
          "Initials or image avatar. Default image alt text follows the Lingui locale; alt can override it.",
      },
    },
  },
} satisfies Meta<typeof Avatar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { name: "Alex Rivera", className: "size-12" } };

export const Image: Story = {
  args: {
    name: "Alex Rivera",
    url: new URL("../icons/brand/github.svg", import.meta.url).href,
    className: "size-12",
  },
};

export const CustomAlt: Story = {
  args: {
    name: "Alex Rivera",
    alt: "Account photo",
    url: new URL("../icons/brand/github.svg", import.meta.url).href,
    className: "size-12",
  },
};
