import { notFound } from "next/navigation";
import { AUDIT_LOG_DB_ENABLED } from "@/lib/constants";
import { getAccessFlags } from "@/lib/membership/utils";
import { getTranslate } from "@/lingodotdev/server";
import { AuditSettingsView } from "@/modules/ee/audit-logs/components/audit-settings-view";
import { getOrganizationAuditMemberOptions } from "@/modules/ee/audit-logs/lib/query";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { redirectBillingRoleFromRestrictedOrgSettings } from "@/modules/settings/lib/redirect-billing-role";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

export const AuditPage = async (props: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  const params = await props.params;
  const t = await getTranslate();

  await redirectBillingRoleFromRestrictedOrgSettings(params.organizationId);

  const { currentUserMembership, organization } = await getOrganizationAuth(params.organizationId);
  const { isOwner, isManager, isAuditor } = getAccessFlags(currentUserMembership.role);

  if (!isOwner && !isManager && !isAuditor) {
    notFound();
  }

  const memberOptions = await getOrganizationAuditMemberOptions(organization.id);
  const pageTitle = t("workspace.settings.audit.title");

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={pageTitle} />
      <AuditSettingsView
        organizationId={organization.id}
        dbEnabled={AUDIT_LOG_DB_ENABLED}
        memberOptions={memberOptions}
      />
    </PageContentWrapper>
  );
};
