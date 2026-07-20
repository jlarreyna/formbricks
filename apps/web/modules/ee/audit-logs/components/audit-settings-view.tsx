"use client";

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, Loader2, XIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { DateRange } from "react-day-picker";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { cn } from "@/lib/cn";
import { formatDateForDisplay, formatDateTimeForDisplay } from "@/lib/utils/datetime";
import {
  exportAuditLogsAction,
  getAuditLogsAction,
  getMembersLastLoginAction,
} from "@/modules/ee/audit-logs/actions";
import { Button } from "@/modules/ui/components/button";
import { Calendar } from "@/modules/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";

type AuditRow = {
  id: string;
  createdAt: string;
  actorId: string;
  actorType: string;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  targetId: string | null;
  targetType: string;
  status: string;
  ipAddress: string | null;
  changes: string | null;
};

type MemberLastLogin = {
  userId: string;
  name: string;
  email: string;
  role: string;
  lastLoginAt: string | null;
};

type MemberOption = {
  userId: string;
  name: string;
  email: string;
};

type AuditFilter = "all" | "access" | "activities" | "modifications" | "last_login";

const PAGE_SIZE = 25;

interface AuditSettingsViewProps {
  organizationId: string;
  dbEnabled: boolean;
  memberOptions: MemberOption[];
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
}: {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  disabled?: boolean;
}) => {
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

const downloadFile = (fileName: string, mimeType: string, content: string, encoding?: "base64") => {
  const blob =
    encoding === "base64"
      ? new Blob([Uint8Array.from(atob(content), (c) => c.charCodeAt(0))], { type: mimeType })
      : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const toStartOfDayIso = (date: Date): string => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay.toISOString();
};

const toEndOfDayIso = (date: Date): string => {
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay.toISOString();
};

const PaginationBar = ({
  page,
  pageCount,
  isPending,
  onPrevious,
  onNext,
  summary,
}: Readonly<{
  page: number;
  pageCount: number;
  isPending: boolean;
  onPrevious: () => void;
  onNext: () => void;
  summary: string;
}>) => (
  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
    <p className="text-sm text-slate-500">{summary}</p>
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" disabled={isPending || page <= 1} onClick={onPrevious}>
        <ChevronLeftIcon className="h-4 w-4" />
      </Button>
      <span className="min-w-20 text-center text-sm text-slate-600">
        {page} / {Math.max(pageCount, 1)}
      </span>
      <Button size="sm" variant="secondary" disabled={isPending || page >= pageCount} onClick={onNext}>
        <ChevronRightIcon className="h-4 w-4" />
      </Button>
    </div>
  </div>
);

export const AuditSettingsView = ({
  organizationId,
  dbEnabled,
  memberOptions,
}: Readonly<AuditSettingsViewProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const [filter, setFilter] = useState<AuditFilter>("all");
  const [actorId, setActorId] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [appliedFilter, setAppliedFilter] = useState<AuditFilter>("all");
  const [appliedActorId, setAppliedActorId] = useState("");
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | undefined>();

  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [lastLoginRows, setLastLoginRows] = useState<MemberLastLogin[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  const [isPending, startTransition] = useTransition();
  const [isExporting, startExport] = useTransition();

  const isLastLogin = appliedFilter === "last_login";

  const loadPage = (pageNumber: number) => {
    startTransition(async () => {
      const isLastLogin = appliedFilter === "last_login";

      if (isLastLogin) {
        const result = await getMembersLastLoginAction({
          organizationId,
          userId: appliedActorId || undefined,
          from: appliedDateRange?.from ? toStartOfDayIso(appliedDateRange.from) : undefined,
          to: appliedDateRange?.to ? toEndOfDayIso(appliedDateRange.to) : undefined,
          page: pageNumber,
          limit: PAGE_SIZE,
        });
        const payload = result?.data;
        if (!payload) return;
        setLastLoginRows(payload.data);
        setTotal(payload.total);
        setPage(payload.page);
        setPageCount(payload.pageCount);
        return;
      }

      if (!dbEnabled) {
        setAuditRows([]);
        setTotal(0);
        setPage(1);
        setPageCount(1);
        return;
      }

      const result = await getAuditLogsAction({
        organizationId,
        section: appliedFilter === "all" ? "all" : appliedFilter,
        actorId: appliedActorId || undefined,
        from: appliedDateRange?.from ? toStartOfDayIso(appliedDateRange.from) : undefined,
        to: appliedDateRange?.to ? toEndOfDayIso(appliedDateRange.to) : undefined,
        page: pageNumber,
        limit: PAGE_SIZE,
      });

      const payload = result?.data;
      if (!payload) return;
      setAuditRows(payload.data);
      setTotal(payload.total);
      setPage(payload.page);
      setPageCount(payload.pageCount);
    });
  };

  useEffect(() => {
    setPage(1);
    loadPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when applied filters change
  }, [appliedFilter, appliedActorId, appliedDateRange, dbEnabled, organizationId]);

  // Check if there are unapplied changes
  const hasUnappliedChanges =
    filter !== appliedFilter ||
    actorId !== appliedActorId ||
    dateRange?.from?.getTime() !== appliedDateRange?.from?.getTime() ||
    dateRange?.to?.getTime() !== appliedDateRange?.to?.getTime();

  const applyFilters = () => {
    setAppliedFilter(filter);
    setAppliedActorId(actorId);
    setAppliedDateRange(dateRange);
  };

  const clearFilters = () => {
    setFilter("all");
    setActorId("");
    setDateRange(undefined);
    setAppliedFilter("all");
    setAppliedActorId("");
    setAppliedDateRange(undefined);
  };

  const handleExport = (format: "csv" | "xlsx") => {
    if (appliedFilter === "last_login") return;
    startExport(async () => {
      const result = await exportAuditLogsAction({
        organizationId,
        format,
        section: appliedFilter === "all" ? "all" : appliedFilter,
        actorId: appliedActorId || undefined,
        from: appliedDateRange?.from ? toStartOfDayIso(appliedDateRange.from) : undefined,
        to: appliedDateRange?.to ? toEndOfDayIso(appliedDateRange.to) : undefined,
      });
      if (result?.data) {
        downloadFile(
          result.data.fileName,
          result.data.mimeType,
          result.data.content,
          "encoding" in result.data ? result.data.encoding : undefined
        );
      }
    });
  };

  const fromRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toRow = Math.min(page * PAGE_SIZE, total);
  const summary = t("workspace.settings.audit.pagination_summary", {
    from: fromRow.toString(),
    to: toRow.toString(),
    total: total.toString(),
  });

  return (
    <SettingsCard
      title={t("workspace.settings.audit.title")}
      description={t("workspace.settings.audit.description")}
      className="max-w-none"
      noPadding>
      <div className="space-y-4 px-4 pb-2">
        <div className="space-y-4">
          {/* Filter Controls */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex min-w-44 flex-col gap-2">
              <label className="text-xs font-medium text-slate-700" htmlFor="audit-type-filter">
                {t("workspace.settings.audit.filter_by_type")}
              </label>
              <select
                id="audit-type-filter"
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm transition-colors",
                  filter !== appliedFilter
                    ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200"
                    : "border-slate-200 bg-white"
                )}
                value={filter}
                onChange={(event) => setFilter(event.target.value as AuditFilter)}>
                <option value="all">{t("workspace.settings.audit.filter_all")}</option>
                <option value="access">{t("workspace.settings.audit.access_registry")}</option>
                <option value="activities">{t("workspace.settings.audit.user_activities")}</option>
                <option value="modifications">{t("workspace.settings.audit.modification_history")}</option>
                <option value="last_login">{t("workspace.settings.audit.last_login")}</option>
              </select>
            </div>

            <div className="flex min-w-52 flex-col gap-2">
              <label className="text-xs font-medium text-slate-700" htmlFor="audit-actor-filter">
                {t("workspace.settings.audit.filter_by_user")}
              </label>
              <select
                id="audit-actor-filter"
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm transition-colors",
                  actorId !== appliedActorId
                    ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200"
                    : "border-slate-200 bg-white"
                )}
                value={actorId}
                onChange={(event) => setActorId(event.target.value)}>
                <option value="">{t("workspace.settings.audit.all_users")}</option>
                {memberOptions.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name} ({member.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-700">
                {t("workspace.settings.audit.date_range")}
              </label>
              <div
                className={cn(
                  "rounded-lg transition-colors",
                  dateRange?.from?.getTime() !== appliedDateRange?.from?.getTime() ||
                    dateRange?.to?.getTime() !== appliedDateRange?.to?.getTime()
                    ? "ring-1 ring-blue-200"
                    : ""
                )}>
                <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
              </div>
            </div>
          </div>

          {/* Action Buttons with Visual Feedback */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-3">
              <Button
                size="sm"
                variant={hasUnappliedChanges ? "default" : "secondary"}
                onClick={applyFilters}
                className={cn(
                  "transition-all duration-200",
                  hasUnappliedChanges && "shadow-md ring-2 ring-blue-200"
                )}
                disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("workspace.settings.audit.apply_filters")}
                {hasUnappliedChanges && (
                  <span className="ml-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-xs text-white">!</span>
                )}
              </Button>
              <Button size="sm" variant="outline" onClick={clearFilters} disabled={isPending}>
                {t("workspace.settings.audit.clear_filters")}
              </Button>
            </div>

            {!isLastLogin && dbEnabled && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  loading={isExporting}
                  onClick={() => handleExport("csv")}>
                  <DownloadIcon className="h-4 w-4" />
                  {t("workspace.settings.audit.export_csv")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={isExporting}
                  onClick={() => handleExport("xlsx")}>
                  <DownloadIcon className="h-4 w-4" />
                  {t("workspace.settings.audit.export_xlsx")}
                </Button>
              </div>
            )}
          </div>

          {/* Visual Indicator for Unapplied Changes */}
          {hasUnappliedChanges && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500"></div>
                {t("workspace.settings.audit.filters_changed_notice")}
              </div>
            </div>
          )}
        </div>

        {!dbEnabled && !isLastLogin ? (
          <p className="text-sm text-slate-500">{t("workspace.settings.audit.db_disabled")}</p>
        ) : isPending && (isLastLogin ? lastLoginRows.length === 0 : auditRows.length === 0) ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : isLastLogin ? (
          lastLoginRows.length === 0 ? (
            <p className="text-sm text-slate-500">{t("workspace.settings.audit.empty_last_login")}</p>
          ) : (
            <div className="w-full overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t("common.name")}</th>
                    <th className="px-4 py-3 font-medium">{t("common.email")}</th>
                    <th className="px-4 py-3 font-medium">{t("common.role")}</th>
                    <th className="px-4 py-3 font-medium">{t("workspace.settings.audit.last_login")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lastLoginRows.map((member) => (
                    <tr key={member.userId}>
                      <td className="px-4 py-3 text-slate-700">{member.name}</td>
                      <td className="px-4 py-3 text-slate-700">{member.email}</td>
                      <td className="px-4 py-3 text-slate-700 capitalize">{member.role}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {member.lastLoginAt
                          ? formatDateTimeForDisplay(new Date(member.lastLoginAt), locale)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : auditRows.length === 0 ? (
          <p className="text-sm text-slate-500">{t("workspace.settings.audit.empty_all")}</p>
        ) : (
          <div className="w-full overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("workspace.settings.audit.column_timestamp")}</th>
                  <th className="px-4 py-3 font-medium">{t("workspace.settings.audit.column_actor")}</th>
                  <th className="px-4 py-3 font-medium">{t("workspace.settings.audit.column_action")}</th>
                  <th className="px-4 py-3 font-medium">{t("workspace.settings.audit.column_target")}</th>
                  <th className="px-4 py-3 font-medium">{t("workspace.settings.audit.column_status")}</th>
                  <th className="px-4 py-3 font-medium">{t("workspace.settings.audit.column_ip")}</th>
                  <th className="px-4 py-3 font-medium">{t("workspace.settings.audit.column_changes")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditRows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                      {formatDateTimeForDisplay(new Date(row.createdAt), locale)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium">{row.actorName || row.actorId}</div>
                      <div className="text-xs text-slate-500">{row.actorEmail || row.actorType}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.action}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{row.targetType}</div>
                      <div className="text-xs text-slate-500">{row.targetId}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.status}</td>
                    <td className="px-4 py-3 text-slate-700">{row.ipAddress || "—"}</td>
                    <td className="max-w-md truncate px-4 py-3 font-mono text-xs text-slate-600">
                      {row.changes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(dbEnabled || isLastLogin) && (
          <PaginationBar
            page={page}
            pageCount={pageCount}
            isPending={isPending}
            summary={summary}
            onPrevious={() => {
              if (page <= 1) return;
              loadPage(page - 1);
            }}
            onNext={() => {
              if (page >= pageCount) return;
              loadPage(page + 1);
            }}
          />
        )}
      </div>
    </SettingsCard>
  );
};
