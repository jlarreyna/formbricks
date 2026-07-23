"use client";

import {
  ArrowUpFromLineIcon,
  CalendarClockIcon,
  FileSpreadsheetIcon,
  MegaphoneIcon,
  SendIcon,
  XIcon,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TEmailCampaignMode } from "@formbricks/types/email-campaigns";
import { cn } from "@/lib/cn";
import { formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { createEmailCampaignAction } from "@/modules/ee/email-campaigns/actions";
import { EmailTemplatePreview } from "@/modules/ee/email-campaigns/components/email-template-preview";
import {
  type TEmailCampaignCsvParseResult,
  parseEmailCampaignCsv,
} from "@/modules/ee/email-campaigns/lib/csv";
import {
  DEFAULT_EMAIL_CAMPAIGN_TEMPLATE,
  interpolateTemplate,
} from "@/modules/ee/email-campaigns/lib/template";
import type { TEmailCampaignTemplateListItem } from "@/modules/ee/email-campaigns/lib/templates";
import { Alert } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { StylingTabs } from "@/modules/ui/components/styling-tabs";

export interface TEmailCampaignSurveyOption {
  id: string;
  name: string;
  hiddenFieldIds: string[];
}

interface EmailCampaignFormProps {
  workspaceId: string;
  surveys: TEmailCampaignSurveyOption[];
  templates: TEmailCampaignTemplateListItem[];
  isSmtpConfigured: boolean;
  onCreated: () => void;
}

const DEFAULT_TEMPLATE_VALUE = "__default__";
type TSendTiming = "now" | "schedule";
const MIN_SCHEDULE_LEAD_TIME_MS = 60 * 1000;

const toDatetimeLocalValue = (date: Date): string => {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const EmailCampaignForm = ({
  workspaceId,
  surveys,
  templates,
  isSmtpConfigured,
  onCreated,
}: EmailCampaignFormProps) => {
  const { t, i18n } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [surveyId, setSurveyId] = useState<string | undefined>(surveys[0]?.id);
  const [mode, setMode] = useState<TEmailCampaignMode>("embed");
  const [subject, setSubject] = useState("");
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<string>(DEFAULT_TEMPLATE_VALUE);
  const [csvParseResult, setCsvParseResult] = useState<TEmailCampaignCsvParseResult | null>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvError, setCsvError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const [sendTiming, setSendTiming] = useState<TSendTiming>("now");
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");

  const selectedSurvey = useMemo(() => surveys.find((survey) => survey.id === surveyId), [surveys, surveyId]);
  const selectedTemplateHtml = useMemo(() => {
    if (templateId === DEFAULT_TEMPLATE_VALUE) return DEFAULT_EMAIL_CAMPAIGN_TEMPLATE;
    return templates.find((template) => template.id === templateId)?.html ?? DEFAULT_EMAIL_CAMPAIGN_TEMPLATE;
  }, [templateId, templates]);

  const availableVariables = useMemo(() => {
    const columns = csvParseResult?.variableColumns ?? [];
    return ["email", "survey_link", "survey", ...columns];
  }, [csvParseResult]);

  const previewHtml = useMemo(() => {
    const first = csvParseResult?.recipients[0];
    const scalars: Record<string, string> = {
      ...(first?.variables ?? {}),
      email: first?.email ?? "person@example.com",
      survey_link: "https://example.com/c/preview",
    };
    return interpolateTemplate(selectedTemplateHtml, {
      scalars,
      raw: {
        survey: `<p style="padding:12px;border:1px dashed #94a3b8;color:#64748b;font-size:13px;">[${t("workspace.email_campaigns.preview_survey_placeholder")}]</p>`,
      },
    });
  }, [csvParseResult, selectedTemplateHtml, t]);

  const minScheduleDatetimeLocal = useMemo(() => toDatetimeLocalValue(new Date(Date.now() + 60_000)), []);

  const isScheduleValid = useMemo(() => {
    if (sendTiming !== "schedule") return true;
    if (!scheduledAtLocal) return false;
    const parsed = new Date(scheduledAtLocal);
    return !Number.isNaN(parsed.getTime()) && parsed.getTime() - Date.now() > MIN_SCHEDULE_LEAD_TIME_MS;
  }, [sendTiming, scheduledAtLocal]);

  const resetForm = () => {
    setSubject("");
    setName("");
    setTemplateId(DEFAULT_TEMPLATE_VALUE);
    setCsvParseResult(null);
    setCsvFileName("");
    setCsvError("");
    setSendTiming("now");
    setScheduledAtLocal("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFile = (file: File) => {
    setCsvError("");
    setCsvParseResult(null);
    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvText = event.target?.result as string;
      try {
        const result = parseEmailCampaignCsv(csvText, selectedSurvey?.hiddenFieldIds ?? []);
        if (result.recipients.length === 0) {
          setCsvError(t("workspace.email_campaigns.form_csv_error_no_valid_recipients"));
          return;
        }
        setCsvParseResult(result);
      } catch {
        setCsvError(t("workspace.email_campaigns.form_csv_error_parse_failed"));
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDraggingCsv(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const clearCsv = () => {
    setCsvParseResult(null);
    setCsvFileName("");
    setCsvError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const canSubmit =
    isSmtpConfigured &&
    surveyId &&
    subject.trim().length > 0 &&
    (csvParseResult?.recipients.length ?? 0) > 0 &&
    isScheduleValid;

  const handleSubmit = async () => {
    if (!surveyId || !csvParseResult || csvParseResult.recipients.length === 0 || !isScheduleValid) {
      return;
    }

    const scheduledAt = sendTiming === "schedule" ? new Date(scheduledAtLocal).toISOString() : undefined;

    setIsSubmitting(true);
    try {
      const result = await createEmailCampaignAction({
        workspaceId,
        surveyId,
        mode,
        subject: subject.trim(),
        name: name.trim() || undefined,
        templateId: templateId === DEFAULT_TEMPLATE_VALUE ? undefined : templateId,
        recipients: csvParseResult.recipients,
        scheduledAt,
      });

      if (result?.data) {
        toast.success(
          scheduledAt
            ? t("workspace.email_campaigns.form_success_scheduled", {
                count: csvParseResult.recipients.length,
                date: formatDateTimeForDisplay(new Date(scheduledAt), i18n.resolvedLanguage ?? i18n.language),
              })
            : t("workspace.email_campaigns.form_success", { count: csvParseResult.recipients.length })
        );
        onCreated();
        resetForm();
        return;
      }

      toast.error(result?.serverError ?? t("workspace.email_campaigns.form_error_generic"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
          <MegaphoneIcon className="size-4.5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {t("workspace.email_campaigns.form_title")}
          </h2>
          <p className="text-sm text-slate-500">{t("workspace.email_campaigns.form_description")}</p>
        </div>
      </div>

      {!isSmtpConfigured && (
        <Alert variant="warning" size="small">
          {t("workspace.email_campaigns.form_smtp_not_configured")}
        </Alert>
      )}

      <div className="flex flex-col gap-4 border-t border-slate-100 pt-6">
        <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
          {t("workspace.email_campaigns.form_section_setup")}
        </p>

        <div className="flex flex-col gap-2">
          <Label>{t("workspace.email_campaigns.form_survey_label")}</Label>
          <Select value={surveyId} onValueChange={setSurveyId}>
            <SelectTrigger>
              <SelectValue placeholder={t("workspace.email_campaigns.form_survey_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {surveys.map((survey) => (
                <SelectItem key={survey.id} value={survey.id}>
                  {survey.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <StylingTabs
            id="email-campaign-mode"
            label={t("workspace.email_campaigns.form_mode_label")}
            options={[
              { value: "embed" as TEmailCampaignMode, label: t("workspace.email_campaigns.form_mode_embed") },
              { value: "link" as TEmailCampaignMode, label: t("workspace.email_campaigns.form_mode_link") },
            ]}
            defaultSelected={mode}
            onChange={setMode}
          />
          <p className="mt-2 text-xs text-slate-500">
            {mode === "embed"
              ? t("workspace.email_campaigns.form_mode_embed_description")
              : t("workspace.email_campaigns.form_mode_link_description")}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-100 pt-6">
        <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
          {t("workspace.email_campaigns.form_section_schedule")}
        </p>

        <div>
          <StylingTabs
            id="email-campaign-send-timing"
            label={t("workspace.email_campaigns.form_schedule_label")}
            options={[
              { value: "now" as TSendTiming, label: t("workspace.email_campaigns.form_schedule_send_now") },
              {
                value: "schedule" as TSendTiming,
                label: t("workspace.email_campaigns.form_schedule_schedule"),
              },
            ]}
            defaultSelected={sendTiming}
            onChange={setSendTiming}
          />
        </div>

        {sendTiming === "schedule" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="email-campaign-scheduled-at">
              {t("workspace.email_campaigns.form_schedule_datetime_label")}
            </Label>
            <Input
              id="email-campaign-scheduled-at"
              type="datetime-local"
              className="max-w-64"
              min={minScheduleDatetimeLocal}
              value={scheduledAtLocal}
              onChange={(event) => setScheduledAtLocal(event.target.value)}
            />
            <p className="text-xs text-slate-500">{t("workspace.email_campaigns.form_schedule_hint")}</p>
            {scheduledAtLocal && !isScheduleValid && (
              <p className="text-xs text-red-600">
                {t("workspace.email_campaigns.form_schedule_error_invalid")}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-100 pt-6">
        <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
          {t("workspace.email_campaigns.form_section_message")}
        </p>

        <div className="flex flex-col gap-2">
          <Label>{t("workspace.email_campaigns.form_template_label")}</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger>
              <SelectValue placeholder={t("workspace.email_campaigns.form_template_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_TEMPLATE_VALUE}>
                {t("workspace.email_campaigns.form_template_default")}
              </SelectItem>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">{t("workspace.email_campaigns.form_template_hint")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email-campaign-subject">
              {t("workspace.email_campaigns.form_subject_label")}
            </Label>
            <Input
              id="email-campaign-subject"
              value={subject}
              maxLength={200}
              onChange={(event) => setSubject(event.target.value)}
              placeholder={t("workspace.email_campaigns.form_subject_placeholder")}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email-campaign-name">{t("workspace.email_campaigns.form_name_label")}</Label>
            <Input
              id="email-campaign-name"
              value={name}
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("workspace.email_campaigns.form_name_placeholder")}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>{t("workspace.email_campaigns.variables_label")}</Label>
          <p className="text-xs text-slate-500">{t("workspace.email_campaigns.variables_hint")}</p>
          <div className="flex flex-wrap gap-2">
            {availableVariables.map((variable) => (
              <code key={variable} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                {`{{${variable}}}`}
              </code>
            ))}
          </div>
        </div>

        <EmailTemplatePreview previewHtml={previewHtml} />
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-6">
        <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
          {t("workspace.email_campaigns.form_section_recipients")}
        </p>

        <div className="flex flex-col gap-2">
          <Label>{t("workspace.email_campaigns.form_csv_label")}</Label>
          <p className="text-xs text-slate-500">
            {selectedSurvey && selectedSurvey.hiddenFieldIds.length > 0
              ? t("workspace.email_campaigns.form_csv_hidden_fields_hint", {
                  fields: selectedSurvey.hiddenFieldIds.join(", "),
                })
              : t("workspace.email_campaigns.form_csv_no_hidden_fields_hint")}
          </p>

          {csvParseResult ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200">
                  <FileSpreadsheetIcon className="size-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{csvFileName}</p>
                  <p className="text-xs text-slate-500">
                    {t("workspace.email_campaigns.form_csv_summary", {
                      validCount: csvParseResult.recipients.length,
                      skippedCount: csvParseResult.skippedRows.length,
                    })}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}>
                  {t("workspace.email_campaigns.csv_change_file")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={t("common.remove")}
                  onClick={clearCsv}>
                  <XIcon className="size-4" />
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          ) : (
            <label
              htmlFor="email-campaign-csv"
              onDragOver={(event) => {
                event.preventDefault();
                setIsDraggingCsv(true);
              }}
              onDragLeave={() => setIsDraggingCsv(false)}
              onDrop={handleDrop}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
                isDraggingCsv
                  ? "border-slate-400 bg-slate-100"
                  : "border-slate-300 bg-slate-50 hover:bg-slate-100"
              )}>
              <ArrowUpFromLineIcon className="h-6 text-slate-500" />
              <p className="mt-2 text-center text-sm text-slate-500">
                {isDraggingCsv
                  ? t("workspace.email_campaigns.csv_drop_hint")
                  : t("common.upload_input_description")}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                id="email-campaign-csv"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          )}

          {csvError && (
            <Alert variant="error" size="small">
              {csvError}
            </Alert>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-6">
        <Button onClick={handleSubmit} loading={isSubmitting} disabled={!canSubmit || isSubmitting}>
          {sendTiming === "schedule" ? <CalendarClockIcon /> : <SendIcon />}
          {sendTiming === "schedule"
            ? t("workspace.email_campaigns.form_submit_scheduled")
            : t("workspace.email_campaigns.form_submit")}
        </Button>
      </div>
    </div>
  );
};
