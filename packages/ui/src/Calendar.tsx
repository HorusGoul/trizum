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
import { use } from "react";
import { cn, focusRing } from "./utils.js";
import { IconButton } from "./IconButton.js";

const Calendar: typeof AriaCalendar = AriaCalendar;

const RangeCalendar = AriaRangeCalendar;

const CalendarHeading = (props: React.HTMLAttributes<HTMLElement>) => {
  const { direction } = useLocale();

  return (
    <header className="flex w-full items-center gap-1 px-1 pb-4" {...props}>
      <IconButton
        slot="previous"
        color="neutral"
        className="size-8 pr-0.5"
        icon={direction === "rtl" ? "lucide.chevron-right" : "lucide.chevron-left"}
        iconClassName="size-4"
      />
      <AriaHeading className="grow text-center text-sm font-medium" />
      <IconButton
        slot="next"
        color="neutral"
        className="size-8 pl-0.5"
        icon={direction === "rtl" ? "lucide.chevron-left" : "lucide.chevron-right"}
        iconClassName="size-4"
      />
    </header>
  );
};

const CalendarGrid = ({ className, ...props }: AriaCalendarGridProps) => (
  <AriaCalendarGrid
    className={cn("border-separate border-spacing-x-1 border-spacing-y-1", className)}
    {...props}
  />
);

const CalendarGridHeader = ({ ...props }: AriaCalendarGridHeaderProps) => (
  <AriaCalendarGridHeader {...props} />
);

const CalendarHeaderCell = ({ className, ...props }: AriaCalendarHeaderCellProps) => (
  <AriaCalendarHeaderCell
    className={cn(
      "w-9 text-[0.8rem] font-medium text-neutral-500 dark:text-neutral-400",
      className,
    )}
    {...props}
  />
);

const CalendarGridBody = ({ className, ...props }: AriaCalendarGridBodyProps) => (
  <AriaCalendarGridBody className={cn("[&>tr>td]:p-0", className)} {...props} />
);

const CalendarCell = ({ className, ...props }: AriaCalendarCellProps) => {
  const isRange = Boolean(use(AriaRangeCalendarStateContext));

  return (
    <AriaCalendarCell
      className={composeRenderProps(className, (className, renderProps) => {
        const isToday = renderProps.date.compare(today(getLocalTimeZone())) === 0;

        const isRangeMiddle =
          renderProps.isSelected &&
          isRange &&
          !renderProps.isSelectionStart &&
          !renderProps.isSelectionEnd;

        return cn(
          "relative flex size-9 cursor-default items-center justify-center rounded-full p-0 text-sm font-normal text-neutral-950 outline-hidden transition-colors dark:text-neutral-50",
          focusRing,
          /* Hover */
          renderProps.isHovered && !renderProps.isSelected && "bg-neutral-950/5 dark:bg-white/10",
          /* Current Date */
          isToday &&
            !renderProps.isSelected &&
            "font-semibold text-accent-600 dark:text-accent-400",
          /* Selected */
          renderProps.isSelected &&
            "bg-accent-500 font-medium text-white dark:bg-accent-500 dark:text-white",
          renderProps.isSelected &&
            renderProps.isHovered &&
            !isRangeMiddle &&
            "bg-accent-600 dark:bg-accent-600",
          /* Range middle */
          isRangeMiddle &&
            "rounded-none bg-accent-500/15 font-normal text-neutral-950 dark:bg-accent-400/20 dark:text-neutral-50",
          /* Outside Month */
          renderProps.isOutsideMonth && "text-neutral-400 opacity-50 dark:text-neutral-500",
          /* Disabled */
          renderProps.isDisabled && "text-neutral-400 opacity-50 dark:text-neutral-500",
          /* Unavailable Date */
          renderProps.isUnavailable && "cursor-default text-danger-500 line-through",
          renderProps.isInvalid && "bg-danger-500 text-white dark:bg-danger-500 dark:text-white",
          className,
        );
      })}
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
