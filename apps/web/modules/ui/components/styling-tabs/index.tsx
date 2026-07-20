import React, { useState } from "react";
import { cn } from "@/lib/cn";
import { Label } from "@/modules/ui/components/label";

interface Option<T> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface StylingTabsProps<T> {
  id: string;
  options: Option<T>[];
  defaultSelected?: T;
  onChange: (value: T) => void;
  className?: string;
  tabsContainerClassName?: string;

  label?: string;
  subLabel?: string;
  activeTabClassName?: string;
  inactiveTabClassName?: string;
}

export const StylingTabs = <T extends string | number>({
  id,
  options,
  defaultSelected,
  onChange,
  className,
  tabsContainerClassName,
  label,
  subLabel,
  activeTabClassName,
  inactiveTabClassName,
}: StylingTabsProps<T>) => {
  const [selectedOption, setSelectedOption] = useState<T | undefined>(defaultSelected);

  const handleSelect = (value: T) => {
    if (selectedOption === value) {
      return;
    }
    setSelectedOption(value);
    onChange(value);
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={`${id}-toggle-label`}
      className={cn("relative flex flex-col gap-2", className)}>
      <>
        {label && (
          <Label id={`${id}-toggle-label`} className="font-semibold">
            {label}
          </Label>
        )}
        {subLabel && <p className="text-sm font-normal text-slate-500">{subLabel}</p>}
      </>

      <div
        className={cn("flex overflow-hidden rounded-md border border-slate-300 p-2", tabsContainerClassName)}>
        {options.map((option) => {
          const isSelected = selectedOption === option.value;
          const optionId = `${id}-${option.value.toString()}`;

          return (
            <button
              key={option.value}
              type="button"
              id={optionId}
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => handleSelect(option.value)}
              className={cn(
                "flex flex-1 items-center justify-center gap-4 rounded-md py-2 text-center text-sm transition-colors",
                "focus-visible:ring-2 focus-visible:ring-brand-dark/50 focus-visible:outline-hidden",
                isSelected
                  ? cn("cursor-default bg-slate-800 font-medium text-white shadow-xs", activeTabClassName)
                  : cn("cursor-pointer bg-white text-slate-700 hover:bg-slate-50", inactiveTabClassName)
              )}>
              <span>{option.label}</span>
              {option.icon && <div>{option.icon}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
};
