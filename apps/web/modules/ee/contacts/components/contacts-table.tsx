"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { VisibilityState, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, Loader2, UsersIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { useTranslation } from "react-i18next";
import { TUserLocale } from "@formbricks/types/user";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { cn } from "@/lib/cn";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { deleteContactAction } from "@/modules/ee/contacts/actions";
import { Button } from "@/modules/ui/components/button";
import { Calendar } from "@/modules/ui/components/calendar";
import {
  DataTableHeader,
  DataTableSettingsModal,
  DataTableToolbar,
} from "@/modules/ui/components/data-table";
import { getCommonPinningStyles } from "@/modules/ui/components/data-table/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { SearchBar } from "@/modules/ui/components/search-bar";
import { Skeleton } from "@/modules/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/modules/ui/components/table";
import { TContactTableData } from "../types/contact";
import { generateContactTableColumns } from "./contact-table-column";

interface ContactsTableProps {
  data: TContactTableData[];
  updateContactList: (contactIds: string[]) => void;
  isDataLoaded: boolean;
  isPending: boolean;
  workspaceId: string;
  searchValue: string;
  setSearchValue: (value: string) => void;
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  hasUnappliedChanges: boolean;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  page: number;
  pageCount: number;
  total: number;
  itemsPerPage: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  isReadOnly: boolean;
  isQuotasAllowed: boolean;
  refreshContacts: () => Promise<void>;
}

const startOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const getDateRangePresets = (): { labelKey: string; getRange: () => DateRange }[] => {
  const today = startOfDay(new Date());
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  const daysAgo = (days: number): Date => {
    const date = new Date(today);
    date.setDate(date.getDate() - days);
    return date;
  };

  return [
    { labelKey: "workspace.settings.audit.date_preset_today", getRange: () => ({ from: today, to: today }) },
    {
      labelKey: "workspace.settings.audit.date_preset_last_7_days",
      getRange: () => ({ from: daysAgo(6), to: today }),
    },
    {
      labelKey: "workspace.settings.audit.date_preset_last_30_days",
      getRange: () => ({ from: daysAgo(29), to: today }),
    },
    {
      labelKey: "workspace.settings.audit.date_preset_this_month",
      getRange: () => ({ from: startOfMonth, to: today }),
    },
    {
      labelKey: "workspace.settings.audit.date_preset_last_month",
      getRange: () => ({ from: startOfLastMonth, to: endOfLastMonth }),
    },
  ];
};

const DateRangePicker = ({
  dateRange,
  onDateRangeChange,
  disabled = false,
}: Readonly<{
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  disabled?: boolean;
}>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const [isOpen, setIsOpen] = useState(false);
  const presets = getDateRangePresets();

  const formatDateRange = (range: DateRange | undefined): string => {
    if (!range?.from) {
      return t("workspace.settings.audit.select_date_range");
    }

    const from = formatDateForDisplay(range.from, locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    if (!range.to || range.to.getTime() === range.from.getTime()) {
      return from;
    }

    const to = formatDateForDisplay(range.to, locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    return `${from} – ${to}`;
  };

  const handleSelect = (range: DateRange | undefined) => {
    onDateRangeChange(range);
    if (range?.from && range?.to) {
      setIsOpen(false);
    }
  };

  const handlePreset = (range: DateRange) => {
    onDateRangeChange(range);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDateRangeChange(undefined);
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "min-w-[240px] justify-start text-left font-normal",
              !dateRange?.from && "text-slate-500"
            )}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatDateRange(dateRange)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            <div className="flex flex-col gap-1 border-r border-slate-200 p-2">
              {presets.map((preset) => (
                <Button
                  key={preset.labelKey}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start font-normal whitespace-nowrap"
                  onClick={() => handlePreset(preset.getRange())}>
                  {t(preset.labelKey)}
                </Button>
              ))}
            </div>
            <Calendar
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={handleSelect}
              numberOfMonths={2}
            />
          </div>
        </PopoverContent>
      </Popover>
      {dateRange?.from && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t("workspace.settings.audit.clear_date_range")}
          onClick={handleClear}
          className="h-9 w-9 p-0 hover:bg-slate-100">
          <XIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export const ContactsTable = ({
  data,
  updateContactList,
  isDataLoaded,
  isPending,
  workspaceId,
  searchValue,
  setSearchValue,
  dateRange,
  setDateRange,
  hasUnappliedChanges,
  onApplyFilters,
  onClearFilters,
  page,
  pageCount,
  total,
  itemsPerPage,
  onPreviousPage,
  onNextPage,
  isReadOnly,
  isQuotasAllowed,
  refreshContacts,
}: ContactsTableProps) => {
  const { workspace } = useWorkspace();
  const workspaceBasePath = `/workspaces/${workspace?.id}`;
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [isTableSettingsModalOpen, setIsTableSettingsModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState<boolean | null>(null);
  const [rowSelection, setRowSelection] = useState({});
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? "en-US") as TUserLocale;

  const [parent] = useAutoAnimate();

  const columns = useMemo(() => {
    return generateContactTableColumns(searchValue, data, isReadOnly, locale, t);
  }, [searchValue, data, isReadOnly, locale, t]);

  useEffect(() => {
    const savedColumnOrder = localStorage.getItem(`${workspaceId}-columnOrder`);
    const savedColumnVisibility = localStorage.getItem(`${workspaceId}-columnVisibility`);
    const savedExpandedSettings = localStorage.getItem(`${workspaceId}-rowExpand`);

    let savedColumnOrderParsed: string[] = [];
    if (savedColumnOrder) {
      try {
        savedColumnOrderParsed = JSON.parse(savedColumnOrder);
      } catch (err) {
        console.error(err);
      }
    }

    if (
      savedColumnOrderParsed.length > 0 &&
      table.getAllLeafColumns().length === savedColumnOrderParsed.length
    ) {
      setColumnOrder(savedColumnOrderParsed);
    } else {
      setColumnOrder(table.getAllLeafColumns().map((d) => d.id));
    }

    let savedColumnVisibilityParsed: VisibilityState = {};
    if (savedColumnVisibility) {
      try {
        savedColumnVisibilityParsed = JSON.parse(savedColumnVisibility);
      } catch (err) {
        console.error(err);
      }
    }

    if (
      savedColumnVisibilityParsed &&
      Object.keys(savedColumnVisibilityParsed).length === table.getAllLeafColumns().length
    ) {
      setColumnVisibility(savedColumnVisibilityParsed);
    } else {
      const initialVisibility = table
        .getAllLeafColumns()
        .map((column) => column.id)
        .reduce<Record<string, boolean>>((acc, curr) => {
          acc[curr] = false;
          return acc;
        }, {});

      const userIdVisibility = data.findIndex((contact) => contact.userId) !== -1;

      setColumnVisibility({
        ...initialVisibility,
        userId: userIdVisibility,
        select: true,
        email: true,
        firstName: true,
        lastName: true,
      });
    }

    if (savedExpandedSettings !== null) {
      setIsExpanded(JSON.parse(savedExpandedSettings));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  useEffect(() => {
    if (columnOrder.length > 0) {
      localStorage.setItem(`${workspaceId}-columnOrder`, JSON.stringify(columnOrder));
    }

    if (Object.keys(columnVisibility).length > 0) {
      localStorage.setItem(`${workspaceId}-columnVisibility`, JSON.stringify(columnVisibility));
    }

    if (isExpanded !== null) {
      localStorage.setItem(`${workspaceId}-rowExpand`, JSON.stringify(isExpanded));
    }
  }, [columnOrder, columnVisibility, isExpanded, workspaceId]);

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  const tableData: TContactTableData[] = useMemo(
    () => (!isDataLoaded ? Array(10).fill({}) : data),
    [data, isDataLoaded]
  );

  const tableColumns = useMemo(
    () =>
      !isDataLoaded
        ? columns.map((column) => ({
            ...column,
            cell: () => (
              <Skeleton className="w-full">
                <div className="h-6"></div>
              </Skeleton>
            ),
          }))
        : columns,
    [columns, isDataLoaded]
  );

  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    getRowId: (originalRow) => originalRow.id,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: setColumnOrder,
    columnResizeMode: "onChange",
    columnResizeDirection: "ltr",
    manualPagination: true,
    defaultColumn: { maxSize: 1000, size: 300 },
    state: {
      columnOrder,
      columnVisibility,
      rowSelection,
      columnPinning: {
        left: ["select", "createdAt"],
      },
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setColumnOrder((prevOrder) => {
        const oldIndex = prevOrder.indexOf(active.id as string);
        const newIndex = prevOrder.indexOf(over.id as string);
        return arrayMove(prevOrder, oldIndex, newIndex);
      });
    }
  };

  const deleteContact = async (contactId: string) => {
    const result = await deleteContactAction({ contactId });
    if (result?.serverError) {
      throw new Error(getFormattedErrorMessage(result));
    }
  };

  const fromRow = total === 0 ? 0 : (page - 1) * itemsPerPage + 1;
  const toRow = Math.min(page * itemsPerPage, total);
  const paginationSummary = t("workspace.settings.audit.pagination_summary", {
    from: fromRow.toString(),
    to: toRow.toString(),
    total: total.toString(),
  });
  const hasActiveFilters = Boolean(searchValue.trim() || dateRange?.from);

  return (
    <div className="w-full">
      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragEnd={handleDragEnd}
        sensors={sensors}>
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 p-4">
            <form
              className="flex flex-wrap items-end gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                onApplyFilters();
              }}>
              <div className="flex min-w-64 flex-col gap-2">
                <label className="text-xs font-medium text-slate-700" htmlFor="contacts-search">
                  {t("workspace.contacts.search_contact")}
                </label>
                <SearchBar
                  value={searchValue}
                  onChange={setSearchValue}
                  placeholder={t("workspace.contacts.search_contact")}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-slate-700">
                  {t("workspace.settings.audit.date_range")}
                </label>
                <DateRangePicker
                  dateRange={dateRange}
                  onDateRangeChange={setDateRange}
                  disabled={isPending}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  size="sm"
                  variant={hasUnappliedChanges ? "default" : "secondary"}
                  disabled={isPending}
                  className={cn(hasUnappliedChanges && "shadow-md ring-2 ring-blue-200")}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("common.apply_filters")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onClearFilters}
                  disabled={isPending}>
                  {t("common.clear_filters")}
                </Button>
              </div>
            </form>
          </div>

          <div className="px-4 pt-3">
            <DataTableToolbar
              setIsExpanded={setIsExpanded}
              setIsTableSettingsModalOpen={setIsTableSettingsModalOpen}
              isExpanded={isExpanded ?? false}
              table={table}
              updateRowList={updateContactList}
              type="contact"
              deleteAction={deleteContact}
              isQuotasAllowed={isQuotasAllowed}
              onRefresh={refreshContacts}
            />
          </div>

          <div className="w-full overflow-x-auto">
            <Table className="w-full" style={{ tableLayout: "fixed" }}>
              <TableHeader className="pointer-events-auto">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                      {headerGroup.headers.map((header) => (
                        <DataTableHeader
                          key={header.id}
                          header={header}
                          setIsTableSettingsModalOpen={setIsTableSettingsModalOpen}
                          showColumnDividers={false}
                        />
                      ))}
                    </SortableContext>
                  </TableRow>
                ))}
              </TableHeader>

              <TableBody ref={parent}>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={"group cursor-pointer"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        onClick={() => {
                          if (cell.column.id === "select") return;
                          router.push(`${workspaceBasePath}/contacts/${row.id}`);
                        }}
                        style={cell.column.id === "select" ? getCommonPinningStyles(cell.column) : {}}
                        className={cn(
                          "border-slate-200 bg-white px-4 py-2 shadow-none group-hover:bg-slate-100",
                          row.getIsSelected() && "bg-slate-100"
                        )}>
                        <div
                          className={cn("flex flex-1 items-center truncate", isExpanded ? "h-10" : "h-full")}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {table.getRowModel().rows.length === 0 && (
                  <TableRow className="hover:bg-white">
                    <TableCell colSpan={columns.length} className="h-auto p-0 text-center">
                      <div className="flex flex-col items-center gap-3 p-10 text-center">
                        <div className="flex size-11 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                          <UsersIcon className="size-5" />
                        </div>
                        <p className="text-sm text-slate-500">
                          {hasActiveFilters
                            ? t("workspace.contacts.table_no_results")
                            : t("workspace.contacts.table_empty_description")}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4">
            <p className="text-sm text-slate-500">{paginationSummary}</p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={isPending || page <= 1}
                onClick={onPreviousPage}>
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              <span className="min-w-20 text-center text-sm text-slate-600">
                {page} / {Math.max(pageCount, 1)}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={isPending || page >= pageCount}
                onClick={onNextPage}>
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <DataTableSettingsModal
          open={isTableSettingsModalOpen}
          setOpen={setIsTableSettingsModalOpen}
          table={table}
          columnOrder={columnOrder}
          handleDragEnd={handleDragEnd}
        />
      </DndContext>
    </div>
  );
};
