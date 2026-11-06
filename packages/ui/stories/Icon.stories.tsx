import type { Meta, StoryObj } from "@storybook/react-vite";
import { Icon } from "@trizum/ui/Icon";

const meta = {
  title: "Components/Icon",
  component: Icon,
  parameters: {
    docs: {
      description: {
        component:
          "Decorative by default. Supply title or aria-label when the icon conveys meaning.",
      },
    },
  },
} satisfies Meta<typeof Icon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { icon: "lucide.heart" } };
export const Accessible: Story = { args: { icon: "lucide.heart", title: "Favorite" } };
export const Brand: Story = { args: { icon: "brand.github", title: "GitHub" } };

export const Illustration: Story = {
  args: { icon: "illustration.shared-expenses", width: 240, height: 180 },
};
