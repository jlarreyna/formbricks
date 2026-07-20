import { redirect } from "next/navigation";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { getOrganizationAuditPath } from "@/modules/settings/lib/routes";

// Org-scoped guard: bounce an auditor-role member away from restricted org settings pages
// to their audit home. getOrganizationAuth is React-cached.
export const redirectAuditorRoleFromRestrictedOrgSettings = async (organizationId: string): Promise<void> => {
  const { isAuditor } = await getOrganizationAuth(organizationId);

  if (isAuditor) {
    redirect(getOrganizationAuditPath(organizationId));
  }
};
