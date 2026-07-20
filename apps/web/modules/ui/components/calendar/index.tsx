"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { Chevron, DayPicker } from "react-day-picker";
import { cn } from "@/lib/cn";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export const Calendar = ({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) => {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "flex items-center",
        button_previous: cn(
          "absolute left-1 hover:text-slate-700 hover:bg-slate-200 flex justify-center items-center rounded-md transition-colors duration-150 ease-in-out h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        button_next: cn(
          "absolute right-1 hover:text-slate-700 hover:bg-slate-200 flex justify-center items-center rounded-md transition-colors duration-150 ease-in-out h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "text-slate-500 rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: cn(
          "text-center text-sm p-0 relative first:[&_button]:rounded-l-md last:[&_button]:rounded-r-md",
          "focus-within:relative focus-within:z-20"
        ),
        day_button: "hover:bg-slate-200 rounded-md h-9 w-9 p-0 font-normal text-center transition-colors",
        selected:
          "[&_button]:bg-black [&_button]:text-white [&_button]:hover:bg-black [&_button]:hover:text-white",
        today: "[&_button]:bg-slate-200 [&_button]:font-semibold",
        range_start:
          "[&_button]:bg-black [&_button]:text-white [&_button]:hover:bg-black [&_button]:hover:text-white",
        range_end:
          "[&_button]:bg-black [&_button]:text-white [&_button]:hover:bg-black [&_button]:hover:text-white",
        range_middle: "[&_button]:rounded-none [&_button]:bg-slate-200 [&_button]:text-slate-900",
        outside: "text-slate-500 opacity-50 [&_button]:opacity-50",
        disabled: "text-slate-500 opacity-50 cursor-not-allowed",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: (props) => {
          if (props.orientation === "left") {
            return <ChevronLeft className="size-4" />;
          } else if (props.orientation === "right") {
            return <ChevronRight className="size-4" />;
          }
          return <Chevron {...props} />;
        },
      }}
      {...props}
    />
  );
};
Calendar.displayName = "Calendar";
