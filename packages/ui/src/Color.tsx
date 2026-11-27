import {
  ColorArea as AriaColorArea,
  type ColorAreaProps as AriaColorAreaProps,
  ColorField as AriaColorField,
  ColorPicker as AriaColorPicker,
  ColorSlider as AriaColorSlider,
  ColorSwatch as AriaColorSwatch,
  ColorSwatchPicker as AriaColorSwatchPicker,
  ColorSwatchPickerItem as AriaColorSwatchPickerItem,
  type ColorSwatchPickerItemProps as AriaColorSwatchPickerItemProps,
  type ColorSwatchPickerProps as AriaColorSwatchPickerProps,
  type ColorSwatchProps as AriaColorSwatchProps,
  ColorThumb as AriaColorThumb,
  type ColorThumbProps as AriaColorThumbProps,
  ColorWheel as AriaColorWheel,
  type ColorWheelProps as AriaColorWheelProps,
  ColorWheelTrack as AriaColorWheelTrack,
  SliderOutput as AriaSliderOutput,
  SliderTrack as AriaSliderTrack,
  type SliderTrackProps as AriaSliderTrackProps,
  composeRenderProps,
} from "react-aria-components";

import { cn, focusRing } from "./utils.js";

const ColorSlider = AriaColorSlider;

const ColorField = AriaColorField;

const ColorWheelTrack = AriaColorWheelTrack;

const ColorPicker = AriaColorPicker;

const SliderOutput = AriaSliderOutput;

interface ColorWheelProps extends Omit<AriaColorWheelProps, "outerRadius" | "innerRadius"> {
  outerRadius?: number;
  innerRadius?: number;
}

function ColorWheel({ className, outerRadius = 100, innerRadius = 74, ...props }: ColorWheelProps) {
  return (
    <AriaColorWheel
      innerRadius={innerRadius}
      outerRadius={outerRadius}
      className={composeRenderProps(className, (className) => cn(className))}
      {...props}
    />
  );
}

function ColorArea({ className, ...props }: AriaColorAreaProps) {
  return (
    <AriaColorArea
      className={composeRenderProps(className, (className) =>
        cn("size-[192px] shrink-0 rounded-2xl shadow-surface", className),
      )}
      {...props}
    />
  );
}

function SliderTrack({ className, ...props }: AriaSliderTrackProps) {
  return (
    <AriaSliderTrack
      className={composeRenderProps(className, (className) =>
        cn("h-7 w-[192px] rounded-full", className),
      )}
      {...props}
    />
  );
}

function ColorThumb({ className, ...props }: AriaColorThumbProps) {
  return (
    <AriaColorThumb
      className={composeRenderProps(className, (className) =>
        cn(
          "z-10 box-border size-5 rounded-full shadow-raised inset-ring-[3px] inset-ring-white",
          /* Focus Visible */
          "data-[focus-visible]:size-6 data-[focus-visible]:outline-solid data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-accent-500 dark:data-[focus-visible]:outline-accent-400",
          className,
        ),
      )}
      {...props}
    />
  );
}

function ColorSwatchPicker({ className, ...props }: AriaColorSwatchPickerProps) {
  return (
    <AriaColorSwatchPicker
      className={composeRenderProps(className, (className) =>
        cn("flex flex-wrap gap-2", className),
      )}
      {...props}
    />
  );
}

function ColorSwatchPickerItem({ className, ...props }: AriaColorSwatchPickerItemProps) {
  return (
    <AriaColorSwatchPickerItem
      className={composeRenderProps(className, (className) =>
        cn(
          "size-8 overflow-hidden rounded-full outline-hidden transition-[outline-color]",
          /* Selected */
          "data-[selected]:outline-solid data-[selected]:outline-2 data-[selected]:outline-offset-2 data-[selected]:outline-neutral-950 dark:data-[selected]:outline-white",
          /* Disabled */
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          /* Focus Visible */
          focusRing,
          className,
        ),
      )}
      {...props}
    />
  );
}

function ColorSwatch({ className, ...props }: AriaColorSwatchProps) {
  return (
    <AriaColorSwatch
      className={composeRenderProps(className, (className) => cn("size-8 rounded-lg", className))}
      {...props}
    />
  );
}

export type { ColorWheelProps };

export {
  ColorSlider,
  ColorField,
  ColorWheelTrack,
  ColorWheel,
  ColorPicker,
  ColorArea,
  SliderTrack,
  SliderOutput,
  ColorThumb,
  ColorSwatchPicker,
  ColorSwatchPickerItem,
  ColorSwatch,
};
