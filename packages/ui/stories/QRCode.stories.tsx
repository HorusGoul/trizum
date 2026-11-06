import type { Meta, StoryObj } from "@storybook/react-vite";
import { QRCode } from "@trizum/ui/QRCode";

const meta = {
  title: "Components/QRCode",
  component: QRCode,
  parameters: {
    docs: {
      description: {
        component:
          "Client-rendered SVG QR code with frame; provide surrounding explanatory content.",
      },
    },
  },
} satisfies Meta<typeof QRCode>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { value: "https://trizum.app" } };
export const Large: Story = { args: { value: "https://trizum.app", size: "xl" } };
