import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarDate, Time } from "@internationalized/date";
import { AppDatePicker, DateRangePicker, DatePickerContent } from "@trizum/ui/DatePicker";
import {
  Calendar,
  RangeCalendar,
  CalendarHeading,
  CalendarGrid,
  CalendarGridHeader,
  CalendarHeaderCell,
  CalendarGridBody,
  CalendarCell,
} from "@trizum/ui/Calendar";
import { DateField, TimeField, DateInput } from "@trizum/ui/fields/DateField";
import { Label, FieldGroup } from "@trizum/ui/fields/Field";
import { IconButton } from "@trizum/ui/IconButton";

const meta = {
  title: "Components/Date and calendar",
  parameters: {
    docs: {
      description: {
        component:
          "Locale-aware segmented date/time fields and calendar primitives. AppDatePicker composes DatePicker, a trigger, popover dialog, and calendar. Change the locale toolbar to compare formatting.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

const date = new CalendarDate(2026, 11, 6);

function CalendarContents() {
  return (
    <>
      <CalendarHeading />
      <CalendarGrid>
        <CalendarGridHeader>
          {(day) => <CalendarHeaderCell>{day}</CalendarHeaderCell>}
        </CalendarGridHeader>
        <CalendarGridBody>{(date) => <CalendarCell date={date} />}</CalendarGridBody>
      </CalendarGrid>
    </>
  );
}

export const Picker: Story = { render: () => <AppDatePicker label="Date" defaultValue={date} /> };

export const Disabled: Story = {
  render: () => <AppDatePicker label="Date" defaultValue={date} isDisabled />,
};

export const Invalid: Story = {
  render: () => <AppDatePicker label="Date" isInvalid errorMessage="Choose another date" />,
};

export const SingleCalendar: Story = {
  render: () => (
    <Calendar aria-label="Date" defaultValue={date}>
      <CalendarContents />
    </Calendar>
  ),
};

export const Range: Story = {
  render: () => (
    <RangeCalendar
      aria-label="Date range"
      defaultValue={{ start: date, end: date.add({ days: 3 }) }}
    >
      <CalendarContents />
    </RangeCalendar>
  ),
};

export const SegmentedDate: Story = {
  render: () => (
    <DateField defaultValue={date}>
      <Label>Date</Label>
      <DateInput />
    </DateField>
  ),
};

export const SegmentedTime: Story = {
  render: () => (
    <TimeField defaultValue={new Time(12, 30)}>
      <Label>Time</Label>
      <DateInput />
    </TimeField>
  ),
};

export const RangePicker: Story = {
  render: () => (
    <DateRangePicker>
      <Label>Date range</Label>
      <FieldGroup>
        <DateInput slot="start" />
        <span>–</span>
        <DateInput slot="end" />
        <IconButton icon="lucide.calendar" aria-label="Choose dates" />
      </FieldGroup>
      <DatePickerContent>
        <RangeCalendar>
          <CalendarContents />
        </RangeCalendar>
      </DatePickerContent>
    </DateRangePicker>
  ),
};
