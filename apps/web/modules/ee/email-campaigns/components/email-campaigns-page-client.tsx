"use client";

import { InboxIcon, MegaphoneIcon, SendHorizontalIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  EmailCampaignForm,
  type TEmailCampaignSurveyOption,
} from "@/modules/ee/email-campaigns/components/email-campaign-form";
import { EmailCampaignList } from "@/modules/ee/email-campaigns/components/email-campaign-list";
import { EmailCampaignTemplatesManager } from "@/modules/ee/email-campaigns/components/email-campaign-templates-manager";
import { TransactionalEmailForm } from "@/modules/ee/email-campaigns/components/transactional-email-form";
import type { TPaginatedEmailCampaigns } from "@/modules/ee/email-campaigns/lib/campaign";
import type { TEmailCampaignTemplateListItem } from "@/modules/ee/email-campaigns/lib/templates";
import { Tabs, TabsList, TabsTrigger } from "@/modules/ui/components/tabs";

interface EmailCampaignsPageClientProps {
  workspaceId: string;
  surveys: TEmailCampaignSurveyOption[];
  initialCampaigns: TPaginatedEmailCampaigns;
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
  const [templates, setTemplates] = useState(initialTemplates);
  const [activeTab, setActiveTab] = useState("campaign");
  const [listReloadToken, setListReloadToken] = useState(0);

  const refreshCampaignList = () => setListReloadToken((current) => current + 1);

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
          <div className="flex flex-col gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="campaign" icon={<MegaphoneIcon />}>
                  {t("workspace.email_campaigns.tab_campaign")}
                </TabsTrigger>
                <TabsTrigger value="transactional" icon={<SendHorizontalIcon />}>
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
                onCreated={refreshCampaignList}
              />
            ) : (
              <TransactionalEmailForm
                workspaceId={workspaceId}
                surveys={surveys}
                templates={templates}
                isSmtpConfigured={isSmtpConfigured}
                onSent={refreshCampaignList}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center">
            <div className="flex size-11 items-center justify-center rounded-lg bg-slate-200 text-slate-500">
              <InboxIcon className="size-5" />
            </div>
            <div>
              <p className="font-medium text-slate-800">{t("workspace.email_campaigns.no_surveys_title")}</p>
              <p className="mt-1 text-sm text-slate-500">{t("workspace.email_campaigns.no_surveys")}</p>
            </div>
          </div>
        ))}

      <EmailCampaignList
        workspaceId={workspaceId}
        initialCampaigns={initialCampaigns}
        reloadToken={listReloadToken}
      />
    </div>
  );
};
