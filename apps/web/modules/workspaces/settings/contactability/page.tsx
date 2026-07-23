import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { getTranslate } from "@/lingodotdev/server";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { ContactabilityRulesForm } from "./components/contactability-rules-form";

export const ContactabilitySettingsPage = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();
  const { isReadOnly, workspace } = await getWorkspaceAuth(params.workspaceId);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("workspace.contactability.page_title")} />
      <SettingsCard
        title={t("workspace.contactability.card_title")}
        description={t("workspace.contactability.card_description")}>
        <ContactabilityRulesForm workspace={workspace} isReadOnly={isReadOnly} />
      </SettingsCard>
    </PageContentWrapper>
  );
};
