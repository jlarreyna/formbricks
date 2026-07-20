"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  EmailCampaignForm,
  type TEmailCampaignSurveyOption,
} from "@/modules/ee/email-campaigns/components/email-campaign-form";
import { EmailCampaignList } from "@/modules/ee/email-campaigns/components/email-campaign-list";
import { EmailCampaignTemplatesManager } from "@/modules/ee/email-campaigns/components/email-campaign-templates-manager";
import { TransactionalEmailForm } from "@/modules/ee/email-campaigns/components/transactional-email-form";
import type { TEmailCampaignListItem } from "@/modules/ee/email-campaigns/lib/campaign";
import type { TEmailCampaignTemplateListItem } from "@/modules/ee/email-campaigns/lib/templates";
import { Tabs, TabsList, TabsTrigger } from "@/modules/ui/components/tabs";

interface EmailCampaignsPageClientProps {
  workspaceId: string;
  surveys: TEmailCampaignSurveyOption[];
  initialCampaigns: TEmailCampaignListItem[];
  initialTemplates: TEmailCampaignTemplateListItem[];
  isReadOnly: boolean;
  isSmtpConfigured: boolean;
}

export const EmailCampaignsPageClient = ({
  workspaceId,
  surveys,
  initialCampaigns,
  initialTemplates,
  isReadOnly,
  isSmtpConfigured,
}: EmailCampaignsPageClientProps) => {
  const { t } = useTranslation();
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [templates, setTemplates] = useState(initialTemplates);
  const [activeTab, setActiveTab] = useState("campaign");

  return (
    <div className="flex flex-col gap-6">
      {!isReadOnly && (
        <EmailCampaignTemplatesManager
          workspaceId={workspaceId}
          templates={templates}
          onTemplatesChange={setTemplates}
          isReadOnly={isReadOnly}
        />
      )}

      {!isReadOnly &&
        (surveys.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="campaign" showIcon={false}>
                  {t("workspace.email_campaigns.tab_campaign")}
                </TabsTrigger>
                <TabsTrigger value="transactional" showIcon={false}>
                  {t("workspace.email_campaigns.tab_transactional")}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {activeTab === "campaign" ? (
              <EmailCampaignForm
                workspaceId={workspaceId}
                surveys={surveys}
                templates={templates}
                isSmtpConfigured={isSmtpConfigured}
                onCreated={(campaign) => setCampaigns((current) => [campaign, ...current])}
              />
            ) : (
              <TransactionalEmailForm
                workspaceId={workspaceId}
                surveys={surveys}
                templates={templates}
                isSmtpConfigured={isSmtpConfigured}
                onSent={(campaign) => setCampaigns((current) => [campaign, ...current])}
              />
            )}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
            {t("workspace.email_campaigns.no_surveys")}
          </p>
        ))}

      <EmailCampaignList workspaceId={workspaceId} campaigns={campaigns} onCampaignsChange={setCampaigns} />
    </div>
  );
};
