"use client";

import { SendIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TEmailCampaignMode } from "@formbricks/types/email-campaigns";
import { cn } from "@/lib/cn";
import { getContactsAction } from "@/modules/ee/contacts/actions";
import { sendTransactionalEmailToContactAction } from "@/modules/ee/email-campaigns/actions";
import type { TEmailCampaignSurveyOption } from "@/modules/ee/email-campaigns/components/email-campaign-form";
import type { TEmailCampaignListItem } from "@/modules/ee/email-campaigns/lib/campaign";
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

const DEFAULT_TEMPLATE_VALUE = "__default__";

interface ContactOption {
  id: string;
  email: string;
  label: string;
  attributes: Record<string, string>;
}

interface TransactionalEmailFormProps {
  workspaceId: string;
  surveys: TEmailCampaignSurveyOption[];
  templates: TEmailCampaignTemplateListItem[];
  isSmtpConfigured: boolean;
  onSent: (campaign: TEmailCampaignListItem) => void;
}

export const TransactionalEmailForm = ({
  workspaceId,
  surveys,
  templates,
  isSmtpConfigured,
  onSent,
}: TransactionalEmailFormProps) => {
  const { t } = useTranslation();
  const contactPickerRef = useRef<HTMLDivElement | null>(null);
  const [surveyId, setSurveyId] = useState<string | undefined>(surveys[0]?.id);
  const [mode, setMode] = useState<TEmailCampaignMode>("embed");
  const [subject, setSubject] = useState("");
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_VALUE);
  const [searchValue, setSearchValue] = useState("");
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsSearching(true);
      getContactsAction({ workspaceId, offset: 0, searchValue: searchValue.trim() || undefined })
        .then((result) => {
          if (!result?.data) {
            setContacts([]);
            return;
          }
          setContacts(
            result.data.map((contact) => {
              const attributes = Object.fromEntries(
                Object.entries(contact.attributes).filter(
                  (entry): entry is [string, string] => typeof entry[1] === "string"
                )
              );
              const email = attributes.email ?? "";
              const displayName = attributes.firstName || attributes.name || attributes.lastName;
              const label = displayName ? `${displayName} (${email || contact.id})` : email || contact.id;
              return { id: contact.id, email, label, attributes };
            })
          );
        })
        .catch(() => setContacts([]))
        .finally(() => setIsSearching(false));
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchValue, workspaceId]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!contactPickerRef.current?.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const selectedTemplateHtml = useMemo(() => {
    if (templateId === DEFAULT_TEMPLATE_VALUE) return DEFAULT_EMAIL_CAMPAIGN_TEMPLATE;
    return templates.find((template) => template.id === templateId)?.html ?? DEFAULT_EMAIL_CAMPAIGN_TEMPLATE;
  }, [templateId, templates]);

  const availableVariables = useMemo(() => {
    const attributeKeys = selectedContact ? Object.keys(selectedContact.attributes) : [];
    return Array.from(new Set(["email", "survey_link", "survey", ...attributeKeys]));
  }, [selectedContact]);

  const previewHtml = useMemo(() => {
    const scalars: Record<string, string> = {
      ...(selectedContact?.attributes ?? {}),
      email: selectedContact?.email ?? "person@example.com",
      survey_link: "https://example.com/c/preview",
    };
    return interpolateTemplate(selectedTemplateHtml, {
      scalars,
      raw: {
        survey: `<p style="padding:12px;border:1px dashed #94a3b8;color:#64748b;font-size:13px;">[${t("workspace.email_campaigns.preview_survey_placeholder")}]</p>`,
      },
    });
  }, [selectedContact, selectedTemplateHtml, t]);

  const canSubmit =
    isSmtpConfigured && surveyId && selectedContact?.id && selectedContact.email && subject.trim().length > 0;

  const handleSelectContact = (contact: ContactOption) => {
    setSelectedContact(contact);
    setSearchValue(contact.label);
    setIsDropdownOpen(false);
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    setSelectedContact(null);
    setIsDropdownOpen(true);
  };

  const handleSubmit = async () => {
    if (!surveyId || !selectedContact) return;

    setIsSubmitting(true);
    try {
      const result = await sendTransactionalEmailToContactAction({
        workspaceId,
        contactId: selectedContact.id,
        surveyId,
        mode,
        subject: subject.trim(),
        templateId: templateId === DEFAULT_TEMPLATE_VALUE ? undefined : templateId,
      });

      if (result?.data) {
        if (result.data.status === "completed" || result.data.sentCount > 0) {
          toast.success(t("workspace.email_campaigns.transactional_success"));
        } else {
          toast.error(t("workspace.email_campaigns.transactional_failed"));
        }
        onSent(result.data);
        setSubject("");
        setSelectedContact(null);
        setSearchValue("");
        return;
      }

      toast.error(result?.serverError ?? t("workspace.email_campaigns.transactional_error_generic"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          {t("workspace.email_campaigns.transactional_title")}
        </h2>
        <p className="text-sm text-slate-500">{t("workspace.email_campaigns.transactional_description")}</p>
      </div>

      {!isSmtpConfigured && (
        <Alert variant="warning" size="small">
          {t("workspace.email_campaigns.form_smtp_not_configured")}
        </Alert>
      )}

      <div className="flex flex-col gap-2" ref={contactPickerRef}>
        <Label htmlFor="transactional-contact-search">
          {t("workspace.email_campaigns.transactional_contact_search_label")}
        </Label>
        <div className="relative">
          <Input
            id="transactional-contact-search"
            value={searchValue}
            onChange={(event) => handleSearchChange(event.target.value)}
            onFocus={() => setIsDropdownOpen(true)}
            placeholder={t("workspace.email_campaigns.transactional_contact_search_placeholder")}
            autoComplete="off"
          />
          {isDropdownOpen && (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-md">
              {isSearching ? (
                <li className="px-3 py-2 text-sm text-slate-500">{t("common.loading")}</li>
              ) : contacts.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-500">
                  {t("workspace.email_campaigns.transactional_contact_empty")}
                </li>
              ) : (
                contacts.map((contact) => (
                  <li key={contact.id}>
                    <button
                      type="button"
                      disabled={!contact.email}
                      onClick={() => handleSelectContact(contact)}
                      className={cn(
                        "flex w-full px-3 py-2 text-left text-sm",
                        contact.email
                          ? "text-slate-800 hover:bg-slate-50"
                          : "cursor-not-allowed text-slate-400"
                      )}>
                      {contact.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
        {selectedContact && !selectedContact.email && (
          <Alert variant="warning" size="small">
            {t("workspace.email_campaigns.transactional_contact_no_email")}
          </Alert>
        )}
      </div>

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
        id="transactional-email-mode"
        label={t("workspace.email_campaigns.form_mode_label")}
        options={[
          { value: "embed" as TEmailCampaignMode, label: t("workspace.email_campaigns.form_mode_embed") },
          { value: "link" as TEmailCampaignMode, label: t("workspace.email_campaigns.form_mode_link") },
        ]}
        defaultSelected={mode}
        onChange={setMode}
      />

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
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="transactional-subject">{t("workspace.email_campaigns.form_subject_label")}</Label>
        <Input
          id="transactional-subject"
          value={subject}
          maxLength={200}
          onChange={(event) => setSubject(event.target.value)}
          placeholder={t("workspace.email_campaigns.form_subject_placeholder")}
        />
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
          {t("workspace.email_campaigns.transactional_submit")}
        </Button>
      </div>
    </div>
  );
};
