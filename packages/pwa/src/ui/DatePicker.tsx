import {
  DatePicker as AriaDatePicker,
  type DatePickerProps as AriaDatePickerProps,
  DateRangePicker as AriaDateRangePicker,
  type DateValue as AriaDateValue,
  Dialog as AriaDialog,
  type DialogProps as AriaDialogProps,
  type PopoverProps as AriaPopoverProps,
  type ValidationResult as AriaValidationResult,
  composeRenderProps,
  Text,
} from "react-aria-components";

import { cn } from "./utils";

import {
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  CalendarHeading,
} from "./Calendar";
import { DateInput } from "./DateField";
import { FieldError, FieldGroup, Label } from "./Field";
import { Popover } from "./Popover";
import { IconButton } from "./IconButton";

const DatePicker = AriaDatePicker;

const DateRangePicker = AriaDateRangePicker;

const DatePickerContent = ({
  className,
  popoverClassName,
  ...props
}: AriaDialogProps & { popoverClassName?: AriaPopoverProps["className"] }) => (
  <Popover
    className={composeRenderProps(popoverClassName, (className) =>
      cn("w-auto p-2", className),
    )}
    placement="bottom end"
  >
    <AriaDialog
      className={cn(
        "flex w-full flex-col space-y-4 outline-none sm:flex-row sm:space-x-4 sm:space-y-0",
        className,
      )}
      {...props}
    />
  </Popover>
);

interface AppDatePickerProps<T extends AriaDateValue>
  extends AriaDatePickerProps<T> {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: AriaValidationResult) => string);
}

function AppDatePicker<T extends AriaDateValue>({
  label,
  description,
  errorMessage,
  className,
  ...props
}: AppDatePickerProps<T>) {
  return (
    <DatePicker<T>
      className={composeRenderProps(className, (className) =>
        cn("group flex flex-col gap-2", className),
      )}
      {...props}
    >
      <Label>{label}</Label>
      <FieldGroup variant="default">
        <DateInput className="flex-1" variant="ghost" />
        <IconButton
          color="transparent"
          className="mr-1 size-6 data-[focus-visible]:ring-offset-0"
          icon="#lucide/calendar"
          iconClassName="size-4"
        />
      </FieldGroup>
      {description && (
        <Text
          className="text-sm text-accent-700 dark:text-accent-50"
          slot="description"
        >
          {description}
        </Text>
      )}
      <FieldError>{errorMessage}</FieldError>
      <DatePickerContent>
        <Calendar>
          <CalendarHeading />
          <CalendarGrid>
            <CalendarGridHeader>
              {(day) => <CalendarHeaderCell>{day}</CalendarHeaderCell>}
            </CalendarGridHeader>
            <CalendarGridBody>
              {(date) => <CalendarCell date={date} />}
            </CalendarGridBody>
          </CalendarGrid>
        </Calendar>
      </DatePickerContent>
    </DatePicker>
  );
}

export { DatePicker, DatePickerContent, DateRangePicker, AppDatePicker };
export type { AppDatePickerProps };
