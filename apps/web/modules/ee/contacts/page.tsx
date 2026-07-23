import { ITEMS_PER_PAGE } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { ContactsPageLayout } from "@/modules/ee/contacts/components/contacts-page-layout";
import { CreateContactButton } from "@/modules/ee/contacts/components/create-contact-button";
import { UploadContactsCSVButton } from "@/modules/ee/contacts/components/upload-contacts-button";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getContacts } from "@/modules/ee/contacts/lib/contacts";
import { getIsContactsEnabled, getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { ContactDataView } from "./components/contact-data-view";

export const ContactsPage = async ({ params: paramsProps }: { params: Promise<{ workspaceId: string }> }) => {
  const params = await paramsProps;

  const { isReadOnly, organization, workspace } = await getWorkspaceAuth(params.workspaceId);

  const t = await getTranslate();

  const isContactsEnabled = await getIsContactsEnabled(organization.id);

  const isQuotasAllowed = await getIsQuotasEnabled(organization.id);

  const contactAttributeKeys = await getContactAttributeKeys(workspace.id);
  const initialContactsResult = await getContacts(
    workspace.id,
    1,
    undefined,
    undefined,
    undefined,
    ITEMS_PER_PAGE
  );

  const AddContactsButton = (
    <div className="flex items-center gap-2">
      <CreateContactButton workspaceId={workspace.id} contactAttributeKeys={contactAttributeKeys} />
      <UploadContactsCSVButton workspaceId={workspace.id} contactAttributeKeys={contactAttributeKeys} />
    </div>
  );

  return (
    <ContactsPageLayout
      pageTitle={t("common.contacts")}
      pageDescription={t("workspace.contacts.page_description")}
      activeId="contacts"
      workspaceId={params.workspaceId}
      organizationId={organization.id}
      isContactsEnabled={isContactsEnabled}
      isReadOnly={isReadOnly}
      cta={AddContactsButton}>
      <ContactDataView
        workspaceId={workspace.id}
        itemsPerPage={ITEMS_PER_PAGE}
        contactAttributeKeys={contactAttributeKeys}
        isReadOnly={isReadOnly}
        initialContacts={initialContactsResult.data}
        initialTotal={initialContactsResult.total}
        initialPage={initialContactsResult.page}
        initialPageCount={initialContactsResult.pageCount}
        isQuotasAllowed={isQuotasAllowed}
      />
    </ContactsPageLayout>
  );
};
