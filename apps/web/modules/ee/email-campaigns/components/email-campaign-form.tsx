"use client";

import { ArrowUpFromLineIcon, SendIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TEmailCampaignMode } from "@formbricks/types/email-campaigns";
import { cn } from "@/lib/cn";
import { createEmailCampaignAction } from "@/modules/ee/email-campaigns/actions";
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
import type { TEmailCampaignListItem } from "../lib/campaign";

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
  onCreated: (campaign: TEmailCampaignListItem) => void;
}

const DEFAULT_TEMPLATE_VALUE = "__default__";

export const EmailCampaignForm = ({
  workspaceId,
  surveys,
  templates,
  isSmtpConfigured,
  onCreated,
}: EmailCampaignFormProps) => {
  const { t } = useTranslation();
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

  const resetForm = () => {
    setSubject("");
    setName("");
    setTemplateId(DEFAULT_TEMPLATE_VALUE);
    setCsvParseResult(null);
    setCsvFileName("");
    setCsvError("");
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

  const canSubmit =
    isSmtpConfigured && surveyId && subject.trim().length > 0 && (csvParseResult?.recipients.length ?? 0) > 0;

  const handleSubmit = async () => {
    if (!surveyId || !csvParseResult || csvParseResult.recipients.length === 0) {
      return;
    }

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
      });

      if (result?.data) {
        toast.success(
          t("workspace.email_campaigns.form_success", { count: csvParseResult.recipients.length })
        );
        onCreated(result.data);
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
      <h2 className="text-lg font-semibold text-slate-900">{t("workspace.email_campaigns.form_title")}</h2>

      {!isSmtpConfigured && (
        <Alert variant="warning" size="small">
          {t("workspace.email_campaigns.form_smtp_not_configured")}
        </Alert>
      )}

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
      <p className="-mt-4 text-xs text-slate-500">
        {mode === "embed"
          ? t("workspace.email_campaigns.form_mode_embed_description")
          : t("workspace.email_campaigns.form_mode_link_description")}
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
          <Label htmlFor="email-campaign-subject">{t("workspace.email_campaigns.form_subject_label")}</Label>
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
        <Label>{t("workspace.email_campaigns.form_csv_label")}</Label>
        <p className="text-xs text-slate-500">
          {selectedSurvey && selectedSurvey.hiddenFieldIds.length > 0
            ? t("workspace.email_campaigns.form_csv_hidden_fields_hint", {
                fields: selectedSurvey.hiddenFieldIds.join(", "),
              })
            : t("workspace.email_campaigns.form_csv_no_hidden_fields_hint")}
        </p>
        <label
          htmlFor="email-campaign-csv"
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 hover:bg-slate-100"
          )}>
          <ArrowUpFromLineIcon className="h-6 text-slate-500" />
          <p className="mt-2 text-center text-sm text-slate-500">
            {csvFileName || t("common.upload_input_description")}
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

        {csvError && (
          <Alert variant="error" size="small">
            {csvError}
          </Alert>
        )}

        {csvParseResult && (
          <Alert variant={csvParseResult.skippedRows.length > 0 ? "warning" : "success"} size="small">
            {t("workspace.email_campaigns.form_csv_summary", {
              validCount: csvParseResult.recipients.length,
              skippedCount: csvParseResult.skippedRows.length,
            })}
          </Alert>
        )}
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

      <div className="flex flex-col gap-2">
        <Label>{t("workspace.email_campaigns.preview_label")}</Label>
        <div
          className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </div>

      <div>
        <Button onClick={handleSubmit} loading={isSubmitting} disabled={!canSubmit || isSubmitting}>
          <SendIcon />
          {t("workspace.email_campaigns.form_submit")}
        </Button>
      </div>
    </div>
  );
};
