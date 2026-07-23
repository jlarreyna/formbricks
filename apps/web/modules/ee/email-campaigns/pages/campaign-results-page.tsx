import { notFound } from "next/navigation";
import { getTranslate } from "@/lingodotdev/server";
import { FailedRecipientsTable } from "@/modules/ee/email-campaigns/components/failed-recipients-table";
import { getEmailCampaignById, getEmailCampaignFailures } from "@/modules/ee/email-campaigns/lib/campaign";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

export const CampaignResultsPage = async (
  props: Readonly<{ params: Promise<{ workspaceId: string; campaignId: string }> }>
) => {
  const { workspaceId, campaignId } = await props.params;
  const t = await getTranslate();

  const { workspace, isOwner, isManager, hasReadAccess, hasReadWriteAccess, hasManageAccess } =
    await getWorkspaceAuth(workspaceId);

  const hasAccess = isOwner || isManager || hasReadAccess || hasReadWriteAccess || hasManageAccess;
  if (!hasAccess) {
    return notFound();
  }

  const campaign = await getEmailCampaignById(campaignId, workspace.id);
  if (!campaign) {
    return notFound();
  }

  const failures = await getEmailCampaignFailures({ campaignId: campaign.id, workspaceId: workspace.id });

  return (
    <PageContentWrapper>
      <GoBackButton url={`/workspaces/${workspace.id}/emails`} />
      <PageHeader pageTitle={campaign.name || campaign.subject}>
        <p className="pb-4 text-sm text-slate-500">
          {t("workspace.email_campaigns.results_summary", {
            total: campaign.totalRecipients,
            sent: campaign.sentCount,
            failed: campaign.failedCount,
            skipped: campaign.skippedCount,
          })}
        </p>
      </PageHeader>
      <FailedRecipientsTable workspaceId={workspace.id} campaignId={campaign.id} initialFailures={failures} />
    </PageContentWrapper>
  );
};
