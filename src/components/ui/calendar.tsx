"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  yearRange?: [number, number];
};

const navButtonClassName = cn(
  buttonVariants({ variant: "outline" }),
  "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
);

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  yearRange = [1970, new Date().getFullYear()],
  ...props
}: CalendarProps) {
  const [fromYear, toYear] = yearRange;

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      // v9+ ships month/year dropdowns natively, replacing the custom Caption
      // component this used to render (the `Caption` slot no longer exists).
      captionLayout="dropdown"
      startMonth={new Date(fromYear, 0)}
      endMonth={new Date(toYear, 11)}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        dropdowns: "flex items-center gap-2",
        dropdown: "bg-background text-sm font-medium",
        nav: "space-x-1 flex items-center",
        button_previous: cn(navButtonClassName, "absolute left-1"),
        button_next: cn(navButtonClassName, "absolute right-1"),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday:
          "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 has-aria-[selected]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r-md",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:has-aria-[selected]:rounded-l-md last:has-aria-[selected]:rounded-r-md"
            : "has-aria-[selected]:rounded-md",
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 p-0 font-normal aria-selected:opacity-100",
        ),
        range_start: "day-range-start",
        range_end: "day-range-end",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "bg-accent text-accent-foreground",
        outside:
          "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeftIcon className="h-4 w-4" />
          ) : (
            <ChevronRightIcon className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
