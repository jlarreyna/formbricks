"use client";

import {
  CopyIcon,
  DownloadIcon,
  Maximize2Icon,
  MoreVerticalIcon,
  SquarePenIcon,
  TrashIcon,
} from "lucide-react";
import { ReactNode, Ref, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

interface DashboardWidgetProps {
  title: string;
  children: ReactNode;
  contentRef?: Ref<HTMLDivElement>;
  isEditing?: boolean;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onResize?: () => void;
  onRemove?: () => void;
  onExport?: () => void;
}

export function DashboardWidget({
  title,
  children,
  contentRef,
  isEditing,
  onEdit,
  onDuplicate,
  onResize,
  onRemove,
  onExport,
}: Readonly<DashboardWidgetProps>) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const hasMenuActions = Boolean(onEdit || onDuplicate || onResize || onRemove || onExport);

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow-xs ring-2 ring-transparent",
        isEditing && "ring-brand-dark/20 transition-shadow hover:ring-brand-dark/40"
      )}>
      <div
        className={cn(
          "flex h-10 items-center justify-between border-b border-gray-100 px-4",
          isEditing && "rgl-drag-handle cursor-grab active:cursor-grabbing"
        )}>
        <h3 className="flex-1 truncate text-sm font-semibold text-gray-800">{title}</h3>
        {hasMenuActions && (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t("common.more_options")}
                className="ml-2 shrink-0 rounded-sm p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}>
                <MoreVerticalIcon className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {onExport && (
                <DropdownMenuItem
                  onSelect={() => {
                    setMenuOpen(false);
                    onExport();
                  }}>
                  <DownloadIcon className="mr-2 size-4" />
                  {t("workspace.analysis.dashboards.export.export_action")}
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem
                  onSelect={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}>
                  <SquarePenIcon className="mr-2 size-4" />
                  {t("common.edit")}
                </DropdownMenuItem>
              )}
              {onDuplicate && (
                <DropdownMenuItem
                  onSelect={() => {
                    setMenuOpen(false);
                    onDuplicate();
                  }}>
                  <CopyIcon className="mr-2 size-4" />
                  {t("common.duplicate")}
                </DropdownMenuItem>
              )}
              {onResize && (
                <DropdownMenuItem
                  onSelect={() => {
                    setMenuOpen(false);
                    onResize();
                  }}>
                  <Maximize2Icon className="mr-2 size-4" />
                  {t("common.resize")}
                </DropdownMenuItem>
              )}
              {onRemove && (
                <DropdownMenuItem
                  onSelect={() => {
                    setMenuOpen(false);
                    onRemove();
                  }}
                  className="text-red-600 focus:text-red-600">
                  <TrashIcon className="mr-2 size-4" />
                  {t("common.remove")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div ref={contentRef} className="relative flex-1 overflow-hidden p-4">
        {children}
      </div>
    </div>
  );
}
