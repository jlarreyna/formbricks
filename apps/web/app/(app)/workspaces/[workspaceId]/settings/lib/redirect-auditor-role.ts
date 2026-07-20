import { redirect } from "next/navigation";
import { getOrganizationAuditPath } from "@/modules/settings/lib/routes";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

export const redirectAuditorRoleFromRestrictedSettings = async (workspaceId: string): Promise<void> => {
  const { isAuditor, organization } = await getWorkspaceAuth(workspaceId);

  if (isAuditor) {
    redirect(getOrganizationAuditPath(organization.id));
  }
};
