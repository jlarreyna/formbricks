"use client";

import {
  CalendarClockIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HistoryIcon,
  Loader2,
  MailIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { DateRange } from "react-day-picker";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TEmailCampaignSource } from "@formbricks/types/email-campaigns";
import { cn } from "@/lib/cn";
import { formatDateForDisplay, formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { Calendar } from "@/modules/ui/components/calendar";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { ProgressBar } from "@/modules/ui/components/progress-bar";
import {
  cancelEmailCampaignAction,
  getEmailCampaignsAction,
  rescheduleEmailCampaignAction,
} from "../actions";
import type { TEmailCampaignListItem, TPaginatedEmailCampaigns } from "../lib/campaign";

const PAGE_SIZE = 25;
const POLL_INTERVAL_MS = 4000;

type SourceFilter = "all" | TEmailCampaignSource;

interface EmailCampaignListProps {
  workspaceId: string;
  initialCampaigns: TPaginatedEmailCampaigns;
  reloadToken?: number;
}

const statusBadgeType = (
  status: TEmailCampaignListItem["status"]
): "success" | "error" | "warning" | "info" | "gray" => {
  if (status === "completed") return "success";
  if (status === "failed") return "error";
  if (status === "scheduled") return "info";
  if (status === "canceled") return "gray";
  return "warning";
};

const sourceBadgeType = (source: TEmailCampaignListItem["source"]): "gray" | "info" | "warning" => {
  if (source === "api") return "info";
  if (source === "transactional") return "warning";
  return "gray";
};

const progressBarColor = (campaign: TEmailCampaignListItem): string => {
  if (campaign.status === "failed") return "bg-red-500";
  if (campaign.failedCount + campaign.skippedCount > 0) return "bg-amber-500";
  return "bg-green-500";
};

const startOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const toStartOfDayIso = (date: Date): string => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value.toISOString();
};

const toEndOfDayIso = (date: Date): string => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value.toISOString();
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
    { labelKey: "workspace.email_campaigns.date_preset_today", getRange: () => ({ from: today, to: today }) },
    {
      labelKey: "workspace.email_campaigns.date_preset_last_7_days",
      getRange: () => ({ from: daysAgo(6), to: today }),
    },
    {
      labelKey: "workspace.email_campaigns.date_preset_last_30_days",
      getRange: () => ({ from: daysAgo(29), to: today }),
    },
    {
      labelKey: "workspace.email_campaigns.date_preset_this_month",
      getRange: () => ({ from: startOfMonth, to: today }),
    },
    {
      labelKey: "workspace.email_campaigns.date_preset_last_month",
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
      return t("workspace.email_campaigns.select_date_range");
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
                  onClick={() => {
                    onDateRangeChange(preset.getRange());
                    setIsOpen(false);
                  }}>
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
          aria-label={t("workspace.email_campaigns.clear_date_range")}
          onClick={(event) => {
            event.stopPropagation();
            onDateRangeChange(undefined);
          }}
          className="h-9 w-9 p-0 hover:bg-slate-100">
          <XIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

const MIN_SCHEDULE_LEAD_TIME_MS = 60 * 1000;

const toDatetimeLocalValue = (date: Date): string => {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const RescheduleDialog = ({
  workspaceId,
  campaign,
  onClose,
  onRescheduled,
}: {
  workspaceId: string;
  campaign: TEmailCampaignListItem | null;
  onClose: () => void;
  onRescheduled: () => void;
}) => {
  const { t } = useTranslation();
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (campaign?.scheduledAt) {
      setScheduledAtLocal(toDatetimeLocalValue(new Date(campaign.scheduledAt)));
    } else {
      setScheduledAtLocal("");
    }
  }, [campaign]);

  const minDatetimeLocal = useMemo(() => toDatetimeLocalValue(new Date(Date.now() + 60_000)), []);

  const isValid = useMemo(() => {
    if (!scheduledAtLocal) return false;
    const parsed = new Date(scheduledAtLocal);
    return !Number.isNaN(parsed.getTime()) && parsed.getTime() - Date.now() > MIN_SCHEDULE_LEAD_TIME_MS;
  }, [scheduledAtLocal]);

  const handleSubmit = async () => {
    if (!campaign || !isValid) return;

    setIsSubmitting(true);
    try {
      const result = await rescheduleEmailCampaignAction({
        workspaceId,
        campaignId: campaign.id,
        scheduledAt: new Date(scheduledAtLocal).toISOString(),
      });

      if (result?.data) {
        toast.success(t("workspace.email_campaigns.reschedule_success"));
        onRescheduled();
        onClose();
        return;
      }

      toast.error(result?.serverError ?? t("workspace.email_campaigns.reschedule_error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={campaign !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("workspace.email_campaigns.reschedule_modal_title")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-slate-500">
              {t("workspace.email_campaigns.reschedule_modal_description")}
            </p>
            <Label htmlFor="email-campaign-reschedule-datetime">
              {t("workspace.email_campaigns.reschedule_datetime_label")}
            </Label>
            <Input
              id="email-campaign-reschedule-datetime"
              type="datetime-local"
              min={minDatetimeLocal}
              value={scheduledAtLocal}
              onChange={(event) => setScheduledAtLocal(event.target.value)}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} loading={isSubmitting} disabled={!isValid || isSubmitting}>
            {t("workspace.email_campaigns.reschedule_submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const EmailCampaignList = ({
  workspaceId,
  initialCampaigns,
  reloadToken = 0,
}: EmailCampaignListProps) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const [isPending, startTransition] = useTransition();

  const [source, setSource] = useState<SourceFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [appliedSource, setAppliedSource] = useState<SourceFilter>("all");
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | undefined>();

  const [campaigns, setCampaigns] = useState(initialCampaigns.data);
  const [page, setPage] = useState(initialCampaigns.page);
  const [total, setTotal] = useState(initialCampaigns.total);
  const [pageCount, setPageCount] = useState(initialCampaigns.pageCount);

  const [campaignToCancel, setCampaignToCancel] = useState<TEmailCampaignListItem | null>(null);
  const [campaignToReschedule, setCampaignToReschedule] = useState<TEmailCampaignListItem | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);

  const hasProcessingCampaign = campaigns.some((campaign) => campaign.status === "processing");
  const appliedFiltersRef = useRef({ source: appliedSource, dateRange: appliedDateRange });
  appliedFiltersRef.current = { source: appliedSource, dateRange: appliedDateRange };

  const loadPage = (pageNumber: number) => {
    startTransition(async () => {
      const { source: currentSource, dateRange: currentDateRange } = appliedFiltersRef.current;
      const result = await getEmailCampaignsAction({
        workspaceId,
        source: currentSource === "all" ? undefined : currentSource,
        from: currentDateRange?.from ? toStartOfDayIso(currentDateRange.from) : undefined,
        to: currentDateRange?.to
          ? toEndOfDayIso(currentDateRange.to)
          : currentDateRange?.from
            ? toEndOfDayIso(currentDateRange.from)
            : undefined,
        page: pageNumber,
        limit: PAGE_SIZE,
      });

      const payload = result?.data;
      if (!payload) return;

      setCampaigns(
        payload.data.map((campaign) => ({
          ...campaign,
          scheduledAt: campaign.scheduledAt ? new Date(campaign.scheduledAt) : null,
          createdAt: new Date(campaign.createdAt),
        }))
      );
      setTotal(payload.total);
      setPage(payload.page);
      setPageCount(payload.pageCount);
    });
  };

  useEffect(() => {
    setPage(1);
    loadPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when applied filters or reloadToken change
  }, [appliedSource, appliedDateRange, workspaceId, reloadToken]);

  useEffect(() => {
    if (!hasProcessingCampaign) {
      return;
    }

    const intervalId = setInterval(() => {
      loadPage(page);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll current page while processing
  }, [hasProcessingCampaign, page, workspaceId, appliedSource, appliedDateRange]);

  const hasUnappliedChanges =
    source !== appliedSource ||
    dateRange?.from?.getTime() !== appliedDateRange?.from?.getTime() ||
    dateRange?.to?.getTime() !== appliedDateRange?.to?.getTime();

  const applyFilters = () => {
    setAppliedSource(source);
    setAppliedDateRange(dateRange);
  };

  const clearFilters = () => {
    setSource("all");
    setDateRange(undefined);
    setAppliedSource("all");
    setAppliedDateRange(undefined);
  };

  const handleCancelConfirm = async () => {
    if (!campaignToCancel) return;

    setIsCanceling(true);
    try {
      const result = await cancelEmailCampaignAction({
        workspaceId,
        campaignId: campaignToCancel.id,
      });

      if (result?.data) {
        toast.success(t("workspace.email_campaigns.cancel_success"));
        loadPage(page);
      } else {
        toast.error(result?.serverError ?? t("workspace.email_campaigns.cancel_error"));
      }
    } finally {
      setIsCanceling(false);
      setCampaignToCancel(null);
    }
  };

  const fromRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toRow = Math.min(page * PAGE_SIZE, total);
  const summary = t("workspace.email_campaigns.pagination_summary", {
    from: fromRow.toString(),
    to: toRow.toString(),
    total: total.toString(),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <HistoryIcon className="size-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {t("workspace.email_campaigns.list_title")}
            </h2>
            <p className="text-sm text-slate-500">{t("workspace.email_campaigns.list_description")}</p>
          </div>
        </div>
        {hasProcessingCampaign && (
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 sm:flex">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
            </span>
            {t("workspace.email_campaigns.list_live_indicator")}
          </span>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex min-w-44 flex-col gap-2">
              <label className="text-xs font-medium text-slate-700" htmlFor="email-campaign-source-filter">
                {t("workspace.email_campaigns.filter_by_source")}
              </label>
              <select
                id="email-campaign-source-filter"
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm transition-colors",
                  source !== appliedSource
                    ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200"
                    : "border-slate-200 bg-white"
                )}
                value={source}
                onChange={(event) => setSource(event.target.value as SourceFilter)}>
                <option value="all">{t("workspace.email_campaigns.filter_source_all")}</option>
                <option value="ui">{t("workspace.email_campaigns.list_source_ui")}</option>
                <option value="api">{t("workspace.email_campaigns.list_source_api")}</option>
                <option value="transactional">
                  {t("workspace.email_campaigns.list_source_transactional")}
                </option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-700">
                {t("workspace.email_campaigns.date_range")}
              </label>
              <div
                className={cn(
                  "rounded-lg transition-colors",
                  dateRange?.from?.getTime() !== appliedDateRange?.from?.getTime() ||
                    dateRange?.to?.getTime() !== appliedDateRange?.to?.getTime()
                    ? "ring-1 ring-blue-200"
                    : ""
                )}>
                <DateRangePicker
                  dateRange={dateRange}
                  onDateRangeChange={setDateRange}
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
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
              {t("common.apply_filters")}
              {hasUnappliedChanges && (
                <span className="ml-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-xs text-white">!</span>
              )}
            </Button>
            <Button size="sm" variant="outline" onClick={clearFilters} disabled={isPending}>
              {t("common.clear_filters")}
            </Button>
          </div>
        </div>

        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="flex size-11 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
              <MailIcon className="size-5" />
            </div>
            <p className="text-sm text-slate-500">
              {appliedSource !== "all" || appliedDateRange?.from
                ? t("workspace.email_campaigns.list_no_results")
                : t("workspace.email_campaigns.list_empty_state")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">{t("workspace.email_campaigns.list_column_name")}</th>
                  <th className="px-4 py-3">{t("workspace.email_campaigns.list_column_survey")}</th>
                  <th className="px-4 py-3">{t("workspace.email_campaigns.list_column_mode")}</th>
                  <th className="px-4 py-3">{t("workspace.email_campaigns.list_column_source")}</th>
                  <th className="px-4 py-3">{t("workspace.email_campaigns.list_column_sent_at")}</th>
                  <th className="px-4 py-3">{t("workspace.email_campaigns.list_column_scheduled_at")}</th>
                  <th className="px-4 py-3">{t("workspace.email_campaigns.list_column_progress")}</th>
                  <th className="px-4 py-3">{t("workspace.email_campaigns.list_column_status")}</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">{t("workspace.email_campaigns.list_column_actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((campaign) => {
                  const processedCount = campaign.sentCount + campaign.failedCount + campaign.skippedCount;
                  const progress =
                    campaign.totalRecipients > 0 ? processedCount / campaign.totalRecipients : 0;
                  return (
                    <tr key={campaign.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex min-w-48 items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                            <MailIcon className="size-3.5" />
                          </div>
                          <div className="max-w-64 min-w-0">
                            <p className="truncate font-medium text-slate-900">
                              {campaign.name || campaign.subject}
                            </p>
                            <p className="truncate text-xs text-slate-500">{campaign.subject}</p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-40 truncate px-4 py-3 text-slate-700" title={campaign.survey.name}>
                        {campaign.survey.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                        {campaign.mode === "embed"
                          ? t("workspace.email_campaigns.form_mode_embed")
                          : t("workspace.email_campaigns.form_mode_link")}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          text={
                            campaign.source === "api"
                              ? t("workspace.email_campaigns.list_source_api")
                              : campaign.source === "transactional"
                                ? t("workspace.email_campaigns.list_source_transactional")
                                : t("workspace.email_campaigns.list_source_ui")
                          }
                          type={sourceBadgeType(campaign.source)}
                          size="tiny"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                        {formatDateTimeForDisplay(new Date(campaign.createdAt), locale)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                        {campaign.scheduledAt
                          ? formatDateTimeForDisplay(new Date(campaign.scheduledAt), locale)
                          : t("workspace.email_campaigns.list_scheduled_immediate")}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/workspaces/${workspaceId}/emails/${campaign.id}`}
                          className="group flex min-w-32 flex-col gap-1">
                          <ProgressBar progress={progress} barColor={progressBarColor(campaign)} height={2} />
                          <span className="text-xs text-slate-500 group-hover:text-slate-800 group-hover:underline">
                            {t("workspace.email_campaigns.list_progress", {
                              processed: processedCount,
                              total: campaign.totalRecipients,
                              failed: campaign.failedCount,
                              skipped: campaign.skippedCount,
                            })}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          text={t(`workspace.email_campaigns.status_${campaign.status}`)}
                          type={statusBadgeType(campaign.status)}
                          size="tiny"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {campaign.status === "scheduled" && (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={t("workspace.email_campaigns.action_reschedule")}
                              onClick={() => setCampaignToReschedule(campaign)}>
                              <CalendarClockIcon className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={t("workspace.email_campaigns.action_cancel")}
                              onClick={() => setCampaignToCancel(campaign)}>
                              <XCircleIcon className="size-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4">
          <p className="text-sm text-slate-500">{summary}</p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={isPending || page <= 1}
              onClick={() => loadPage(page - 1)}>
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <span className="min-w-20 text-center text-sm text-slate-600">
              {page} / {Math.max(pageCount, 1)}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={isPending || page >= pageCount}
              onClick={() => loadPage(page + 1)}>
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        open={campaignToCancel !== null}
        setOpen={(open) => !open && setCampaignToCancel(null)}
        title={t("workspace.email_campaigns.cancel_confirm_title")}
        body={t("workspace.email_campaigns.cancel_confirm_description")}
        buttonText={t("workspace.email_campaigns.action_cancel")}
        buttonVariant="destructive"
        buttonLoading={isCanceling}
        isButtonDisabled={isCanceling}
        onConfirm={handleCancelConfirm}
      />

      <RescheduleDialog
        workspaceId={workspaceId}
        campaign={campaignToReschedule}
        onClose={() => setCampaignToReschedule(null)}
        onRescheduled={() => loadPage(page)}
      />
    </div>
  );
};
