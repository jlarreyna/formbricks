import { redirect } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getAuditorFallbackPath, getBillingFallbackPath } from "@/lib/membership/navigation";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

const WorkspacePage = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  const { session, organization } = await getWorkspaceAuth(params.workspaceId);

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isBilling, isAuditor } = getAccessFlags(currentUserMembership?.role);

  if (isBilling) {
    return redirect(getBillingFallbackPath(organization.id, IS_FORMBRICKS_CLOUD));
  }

  if (isAuditor) {
    return redirect(getAuditorFallbackPath(organization.id));
  }

  return redirect(`/workspaces/${params.workspaceId}/surveys`);
};

export default WorkspacePage;
