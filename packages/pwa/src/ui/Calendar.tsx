import { getLocalTimeZone, today } from "@internationalized/date";
import {
  Calendar as AriaCalendar,
  CalendarCell as AriaCalendarCell,
  type CalendarCellProps as AriaCalendarCellProps,
  CalendarGrid as AriaCalendarGrid,
  CalendarGridBody as AriaCalendarGridBody,
  type CalendarGridBodyProps as AriaCalendarGridBodyProps,
  CalendarGridHeader as AriaCalendarGridHeader,
  type CalendarGridHeaderProps as AriaCalendarGridHeaderProps,
  type CalendarGridProps as AriaCalendarGridProps,
  CalendarHeaderCell as AriaCalendarHeaderCell,
  type CalendarHeaderCellProps as AriaCalendarHeaderCellProps,
  Heading as AriaHeading,
  RangeCalendar as AriaRangeCalendar,
  RangeCalendarStateContext as AriaRangeCalendarStateContext,
  composeRenderProps,
  useLocale,
} from "react-aria-components";
import { useContext } from "react";
import { cn } from "./utils";
import { IconButton } from "./IconButton";

const Calendar = AriaCalendar;

const RangeCalendar = AriaRangeCalendar;

const CalendarHeading = (props: React.HTMLAttributes<HTMLElement>) => {
  let { direction } = useLocale();

  return (
    <header className="flex w-full items-center gap-1 px-1 pb-4" {...props}>
      <IconButton
        slot="previous"
        color="input-like"
        className="size-7 pr-0.5"
        icon={
          direction === "rtl" ? "#lucide/chevron-right" : "#lucide/chevron-left"
        }
        iconClassName="size-4"
      />
      <AriaHeading className="grow text-center text-sm font-medium" />
      <IconButton
        slot="next"
        color="input-like"
        className="size-7 pl-0.5"
        icon={
          direction === "rtl" ? "#lucide/chevron-left" : "#lucide/chevron-right"
        }
        iconClassName="size-4"
      />
    </header>
  );
};

const CalendarGrid = ({ className, ...props }: AriaCalendarGridProps) => (
  <AriaCalendarGrid
    className={cn(
      "border-separate border-spacing-x-1 border-spacing-y-1",
      className,
    )}
    {...props}
  />
);

const CalendarGridHeader = ({ ...props }: AriaCalendarGridHeaderProps) => (
  <AriaCalendarGridHeader {...props} />
);

const CalendarHeaderCell = ({
  className,
  ...props
}: AriaCalendarHeaderCellProps) => (
  <AriaCalendarHeaderCell
    className={cn(
      "w-9 rounded-md text-[0.8rem] font-normal text-slate-700 dark:text-slate-50",
      className,
    )}
    {...props}
  />
);

const CalendarGridBody = ({
  className,
  ...props
}: AriaCalendarGridBodyProps) => (
  <AriaCalendarGridBody className={cn("[&>tr>td]:p-0", className)} {...props} />
);

const CalendarCell = ({ className, ...props }: AriaCalendarCellProps) => {
  const isRange = Boolean(useContext(AriaRangeCalendarStateContext));
  return (
    <AriaCalendarCell
      className={composeRenderProps(className, (className, renderProps) =>
        cn(
          "data-[hovered]:bg-accent-500/20 data-[hovered]:text-accent-50", // TODO: replace this with button ghost variant or something
          "relative flex size-9 items-center justify-center p-0 text-sm font-normal",
          /* Disabled */
          renderProps.isDisabled &&
            "text-slate-700 opacity-50 dark:text-slate-50",
          /* Selected */
          renderProps.isSelected &&
            "bg-accent-500 text-accent-50 data-[focused]:bg-accent-500 data-[focused]:text-accent-50",
          /* Hover */
          renderProps.isHovered &&
            renderProps.isSelected &&
            (renderProps.isSelectionStart ||
              renderProps.isSelectionEnd ||
              !isRange) &&
            "data-[hovered]:bg-accent-400 data-[hovered]:text-accent-50",
          /* Selection Start/End */
          renderProps.isSelected &&
            isRange &&
            !renderProps.isSelectionStart &&
            !renderProps.isSelectionEnd &&
            "rounded-none bg-accent-500 text-accent-50",
          /* Outside Month */
          renderProps.isOutsideMonth &&
            "text-slate-700 opacity-50 data-[selected]:bg-accent-500/50 data-[selected]:text-accent-50 data-[selected]:opacity-30 dark:text-slate-50",
          /* Current Date */
          renderProps.date.compare(today(getLocalTimeZone())) === 0 &&
            !renderProps.isSelected &&
            "bg-accent-600 text-accent-50 data-[hovered]:bg-accent-400 data-[hovered]:text-accent-50",
          /* Unavailable Date */
          renderProps.isUnavailable && "cursor-default text-danger-500",
          renderProps.isInvalid &&
            "bg-danger-500 text-danger-50 data-[focused]:bg-danger-500 data-[hovered]:bg-danger-500 data-[focused]:text-danger-50 data-[hovered]:text-danger-50",
          className,
        ),
      )}
      {...props}
    />
  );
};

export {
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  CalendarHeading,
  RangeCalendar,
};
