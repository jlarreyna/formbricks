"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDownIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/cn";
import { Switch } from "@/modules/ui/components/switch";

interface RuleCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
  defaultOpen?: boolean;
}

export const RuleCard = ({
  title,
  description,
  icon,
  enabled,
  onEnabledChange,
  disabled = false,
  children,
  defaultOpen = true,
}: Readonly<RuleCardProps>) => {
  const [open, setOpen] = useState(defaultOpen || enabled);

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "w-full rounded-xl border bg-white shadow-sm transition-colors",
        enabled ? "border-slate-200" : "border-slate-100 bg-slate-50/50"
      )}>
      <div className="flex items-start gap-3 px-4 py-4 sm:items-center sm:px-5">
        <div
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
            enabled ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-500"
          )}>
          {icon}
        </div>
        <Collapsible.CollapsibleTrigger asChild>
          <button type="button" className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
              <ChevronDownIcon
                className={cn("size-4 text-slate-400 transition-transform", open && "rotate-180")}
              />
            </div>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{description}</p>
          </button>
        </Collapsible.CollapsibleTrigger>
        <Switch
          checked={enabled}
          disabled={disabled}
          onCheckedChange={onEnabledChange}
          aria-label={`Toggle ${title}`}
        />
      </div>
      <Collapsible.CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div
          className={cn(
            "border-t border-slate-100 px-4 py-4 sm:px-5",
            !enabled && "pointer-events-none opacity-50"
          )}>
          {children}
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
