import type { Meta, StoryObj } from "@storybook/react-vite";
import { Alert, AlertTitle, AlertDescription } from "@trizum/ui/Alert";
import { Icon } from "@trizum/ui/Icon";

const meta = {
  title: "Components/Alert",
  component: Alert,
  parameters: {
    docs: {
      description: {
        component:
          "Compose AlertTitle and AlertDescription inside the semantic alert. Destructive is the existing error treatment.",
      },
    },
  },
} satisfies Meta<typeof Alert>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Alert>
      <Icon icon="lucide.info" />
      <AlertTitle>Information</AlertTitle>
      <AlertDescription>Your changes are saved locally.</AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive">
      <Icon icon="lucide.circle-alert" />
      <AlertTitle>Unable to continue</AlertTitle>
      <AlertDescription>Check the supplied details.</AlertDescription>
    </Alert>
  ),
};
