import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox, CheckboxGroup, JollyCheckboxGroup } from "@trizum/ui/Checkbox";

const meta = {
  title: "Components/Checkbox",
  parameters: {
    docs: {
      description: {
        component:
          "Checkbox supports selected, indeterminate, disabled, and async selection. Group primitives compose with labels and validation.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const Default: Story = { render: () => <Checkbox>Remember selection</Checkbox> };

export const Selected: Story = {
  render: () => <Checkbox defaultSelected>Remember selection</Checkbox>,
};

export const Indeterminate: Story = {
  render: () => <Checkbox isIndeterminate>Some selected</Checkbox>,
};

export const Disabled: Story = { render: () => <Checkbox isDisabled>Unavailable</Checkbox> };

export const Group: Story = {
  render: () => (
    <JollyCheckboxGroup label="Options" defaultValue={["one"]}>
      <Checkbox value="one">First</Checkbox>
      <Checkbox value="two">Second</Checkbox>
    </JollyCheckboxGroup>
  ),
};

export const PrimitiveGroup: Story = {
  render: () => (
    <CheckboxGroup aria-label="Options">
      <Checkbox value="one">First</Checkbox>
      <Checkbox value="two">Second</Checkbox>
    </CheckboxGroup>
  ),
};
