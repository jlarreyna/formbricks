"use client";

import { ChevronDownIcon, FileTextIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import {
  createEmailCampaignTemplateAction,
  deleteEmailCampaignTemplateAction,
  updateEmailCampaignTemplateAction,
} from "@/modules/ee/email-campaigns/actions";
import { DEFAULT_EMAIL_CAMPAIGN_TEMPLATE } from "@/modules/ee/email-campaigns/lib/template";
import type { TEmailCampaignTemplateListItem } from "@/modules/ee/email-campaigns/lib/templates";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";

interface EmailCampaignTemplatesManagerProps {
  workspaceId: string;
  templates: TEmailCampaignTemplateListItem[];
  onTemplatesChange: (templates: TEmailCampaignTemplateListItem[]) => void;
  isReadOnly: boolean;
}

export const EmailCampaignTemplatesManager = ({
  workspaceId,
  templates,
  onTemplatesChange,
  isReadOnly,
}: EmailCampaignTemplatesManagerProps) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState(DEFAULT_EMAIL_CAMPAIGN_TEMPLATE);
  const [isSaving, setIsSaving] = useState(false);

  const resetEditor = () => {
    setIsEditing(false);
    setEditingId(null);
    setName("");
    setSubject("");
    setHtml(DEFAULT_EMAIL_CAMPAIGN_TEMPLATE);
  };

  const startCreate = () => {
    setIsExpanded(true);
    setEditingId(null);
    setName("");
    setSubject("");
    setHtml(DEFAULT_EMAIL_CAMPAIGN_TEMPLATE);
    setIsEditing(true);
  };

  const startEdit = (template: TEmailCampaignTemplateListItem) => {
    setEditingId(template.id);
    setName(template.name);
    setSubject(template.subject ?? "");
    setHtml(template.html);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !html.trim()) {
      toast.error(t("workspace.email_campaigns.templates_error_required"));
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        const result = await updateEmailCampaignTemplateAction({
          workspaceId,
          templateId: editingId,
          name: name.trim(),
          subject: subject.trim() || null,
          html,
        });
        if (result?.data) {
          const updated = result.data;
          onTemplatesChange(templates.map((item) => (item.id === editingId ? updated : item)));
          toast.success(t("workspace.email_campaigns.templates_updated"));
          resetEditor();
          return;
        }
        toast.error(result?.serverError ?? t("workspace.email_campaigns.templates_error_generic"));
        return;
      }

      const result = await createEmailCampaignTemplateAction({
        workspaceId,
        name: name.trim(),
        subject: subject.trim() || undefined,
        html,
      });
      if (result?.data) {
        onTemplatesChange([result.data, ...templates]);
        toast.success(t("workspace.email_campaigns.templates_created"));
        resetEditor();
        return;
      }
      toast.error(result?.serverError ?? t("workspace.email_campaigns.templates_error_generic"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    const result = await deleteEmailCampaignTemplateAction({ workspaceId, templateId });
    if (result?.data) {
      onTemplatesChange(templates.filter((item) => item.id !== templateId));
      toast.success(t("workspace.email_campaigns.templates_deleted"));
      if (editingId === templateId) {
        resetEditor();
      }
      return;
    }
    toast.error(result?.serverError ?? t("workspace.email_campaigns.templates_error_generic"));
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => setIsExpanded((current) => !current)}
          aria-expanded={isExpanded}>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <FileTextIcon className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-slate-900">
                {t("workspace.email_campaigns.templates_title")}
              </h2>
              {templates.length > 0 && (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                  {templates.length}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">{t("workspace.email_campaigns.templates_description")}</p>
          </div>
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-slate-400 transition-transform",
              isExpanded ? "rotate-180" : "rotate-0"
            )}
          />
        </button>
        {!isReadOnly && !isEditing && (
          <Button size="sm" variant="secondary" onClick={startCreate}>
            <PlusIcon />
            {t("workspace.email_campaigns.templates_new")}
          </Button>
        )}
      </div>

      {isExpanded && (
        <>
          {isEditing && !isReadOnly && (
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>{t("workspace.email_campaigns.templates_name_label")}</Label>
                  <Input value={name} maxLength={200} onChange={(event) => setName(event.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{t("workspace.email_campaigns.templates_subject_label")}</Label>
                  <Input
                    value={subject}
                    maxLength={200}
                    onChange={(event) => setSubject(event.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t("workspace.email_campaigns.templates_html_label")}</Label>
                <p className="text-xs text-slate-500">{t("workspace.email_campaigns.templates_html_hint")}</p>
                <textarea
                  className="min-h-48 w-full rounded-md border border-slate-300 bg-white p-3 font-mono text-xs text-slate-800"
                  value={html}
                  onChange={(event) => setHtml(event.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} loading={isSaving} disabled={isSaving}>
                  {editingId
                    ? t("workspace.email_campaigns.templates_save")
                    : t("workspace.email_campaigns.templates_create")}
                </Button>
                <Button variant="secondary" onClick={resetEditor} disabled={isSaving}>
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          )}

          {templates.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
              {t("workspace.email_campaigns.templates_empty")}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {templates.map((template) => (
                <li
                  key={template.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{template.name}</p>
                    {template.subject && (
                      <p className="truncate text-xs text-slate-500">{template.subject}</p>
                    )}
                  </div>
                  {!isReadOnly && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={t("common.edit")}
                        onClick={() => startEdit(template)}>
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        aria-label={t("common.delete")}
                        onClick={() => handleDelete(template.id)}>
                        <Trash2Icon className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};
