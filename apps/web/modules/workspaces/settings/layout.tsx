import { Metadata } from "next";
import { redirect } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getAuditorFallbackPath, getBillingFallbackPath } from "@/lib/membership/navigation";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

export const metadata: Metadata = {
  title: "Configuration",
};

export const WorkspaceSettingsLayout = async (props: {
  params: Promise<{ workspaceId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;
  const { children } = props;

  try {
    const { isBilling, isAuditor, organization } = await getWorkspaceAuth(params.workspaceId);

    if (isBilling) {
      return redirect(getBillingFallbackPath(organization.id, IS_FORMBRICKS_CLOUD));
    }

    if (isAuditor) {
      return redirect(getAuditorFallbackPath(organization.id));
    }

    return children;
  } catch (error) {
    // The error boundary will catch this
    throw error;
  }
};
