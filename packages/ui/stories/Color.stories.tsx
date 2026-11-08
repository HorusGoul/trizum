import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ColorPicker,
  ColorArea,
  ColorThumb,
  ColorSlider,
  SliderTrack,
  SliderOutput,
  ColorField,
  ColorWheel,
  ColorWheelTrack,
  ColorSwatch,
  ColorSwatchPicker,
  ColorSwatchPickerItem,
} from "@trizum/ui/Color";
import { Input } from "@trizum/ui/fields/TextFieldPrimitives";
import { Label } from "@trizum/ui/fields/Field";

const meta = {
  title: "Components/Color",
  parameters: {
    docs: {
      description: {
        component:
          "Compose React Aria color controls inside ColorPicker to share selection. Wheel, area, slider, field, and swatches expose the original PWA styling.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const Picker: Story = {
  render: () => (
    <ColorPicker defaultValue="#6366f1">
      <div className="flex flex-col gap-4">
        <ColorArea colorSpace="hsb" xChannel="saturation" yChannel="brightness" aria-label="Color">
          <ColorThumb />
        </ColorArea>
        <ColorSlider channel="hue" colorSpace="hsb">
          <Label>Hue</Label>
          <SliderTrack>
            <ColorThumb />
          </SliderTrack>
          <SliderOutput />
        </ColorSlider>
        <ColorField>
          <Label>Hex color</Label>
          <Input />
        </ColorField>
        <ColorSwatch />
      </div>
    </ColorPicker>
  ),
};

export const Wheel: Story = {
  render: () => (
    <ColorWheel defaultValue="hsl(250, 100%, 50%)" aria-label="Hue">
      <ColorWheelTrack />
      <ColorThumb />
    </ColorWheel>
  ),
};

export const Swatches: Story = {
  render: () => (
    <ColorSwatchPicker aria-label="Color" defaultValue="#6366f1">
      <ColorSwatchPickerItem color="#6366f1">
        <ColorSwatch />
      </ColorSwatchPickerItem>
      <ColorSwatchPickerItem color="#22c55e">
        <ColorSwatch />
      </ColorSwatchPickerItem>
      <ColorSwatchPickerItem color="#f97316">
        <ColorSwatch />
      </ColorSwatchPickerItem>
    </ColorSwatchPicker>
  ),
};
