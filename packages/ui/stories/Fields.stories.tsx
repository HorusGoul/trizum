import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { AppTextField } from "@trizum/ui/fields/AppTextField";
import { AppNumberField } from "@trizum/ui/fields/AppNumberField";
import { AppCurrencyField } from "@trizum/ui/fields/AppCurrencyField";
import { TextField, Input, TextArea, NumberField } from "@trizum/ui/fields/TextFieldPrimitives";
import { Label, FormDescription, FieldGroup, FieldError } from "@trizum/ui/fields/Field";

const meta = {
  title: "Components/Fields",
  parameters: {
    docs: {
      description: {
        component:
          "App-prefixed composites preserve PWA APIs. Primitives allow custom labels, descriptions, validation, and field groups. TextField also re-exports the composites.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const Text: Story = {
  render: () => <AppTextField label="Name" description="Display name" defaultValue="Alex" />,
};

export const Multiline: Story = { render: () => <AppTextField label="Notes" textArea /> };

export const Disabled: Story = {
  render: () => <AppTextField label="Name" defaultValue="Alex" isDisabled />,
};

export const Invalid: Story = {
  render: () => <AppTextField label="Name" isInvalid errorMessage="Enter a name" />,
};

export const Number: Story = {
  render: () => <AppNumberField label="Quantity" defaultValue={2} minValue={0} />,
};

function CurrencyExample() {
  const [value, setValue] = useState(12.5);

  return <AppCurrencyField label="Amount" currency="EUR" value={value} onChange={setValue} />;
}

export const Currency: Story = { render: () => <CurrencyExample /> };

export const Composed: Story = {
  render: () => (
    <TextField>
      <Label>Name</Label>
      <FieldGroup>
        <Input />
      </FieldGroup>
      <FormDescription>Shown on your profile</FormDescription>
      <FieldError />
    </TextField>
  ),
};

export const TextAreaPrimitive: Story = {
  render: () => (
    <TextField>
      <Label>Notes</Label>
      <TextArea />
    </TextField>
  ),
};

export const NumberPrimitive: Story = {
  render: () => (
    <NumberField defaultValue={3}>
      <Label>Quantity</Label>
      <Input />
    </NumberField>
  ),
};
