import { notFound } from "next/navigation";
import { getSurveys } from "@/lib/survey/service";
import { getTranslate } from "@/lingodotdev/server";
import { EmailCampaignsPageClient } from "@/modules/ee/email-campaigns/components/email-campaigns-page-client";
import { getEmailCampaigns } from "@/modules/ee/email-campaigns/lib/campaign";
import { getEmailCampaignTemplates } from "@/modules/ee/email-campaigns/lib/templates";
import { IS_SMTP_CONFIGURED } from "@/modules/email";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

export const EmailCampaignsPage = async (props: Readonly<{ params: Promise<{ workspaceId: string }> }>) => {
  const { workspaceId } = await props.params;
  const t = await getTranslate();

  const { workspace, isOwner, isManager, hasReadAccess, hasReadWriteAccess, hasManageAccess, isReadOnly } =
    await getWorkspaceAuth(workspaceId);

  const hasAccess = isOwner || isManager || hasReadAccess || hasReadWriteAccess || hasManageAccess;
  if (!hasAccess) {
    return notFound();
  }

  const [surveys, campaigns, templates] = await Promise.all([
    getSurveys(workspace.id),
    getEmailCampaigns(workspace.id),
    getEmailCampaignTemplates(workspace.id),
  ]);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("workspace.email_campaigns.title")} />
      <EmailCampaignsPageClient
        workspaceId={workspace.id}
        surveys={surveys.map((survey) => ({
          id: survey.id,
          name: survey.name,
          hiddenFieldIds: survey.hiddenFields.enabled ? (survey.hiddenFields.fieldIds ?? []) : [],
        }))}
        initialCampaigns={campaigns}
        initialTemplates={templates}
        isReadOnly={isReadOnly}
        isSmtpConfigured={IS_SMTP_CONFIGURED}
      />
    </PageContentWrapper>
  );
};
