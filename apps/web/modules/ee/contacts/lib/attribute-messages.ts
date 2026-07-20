export interface TAttributeMessage {
  code: string;
  params: Record<string, string>;
}

/**
 * Translates a structured attribute message (returned by `updateAttributes` / `createContact`)
 * into a human-readable, localized string. Shared between the "create contact" and
 * "edit contact attributes" UI so both surfaces stay in sync when a new message code is added.
 */
export const translateAttributeMessage = (
  { code, params }: TAttributeMessage,
  t: (key: string, params?: Record<string, string>) => string
): string => {
  switch (code) {
    case "email_or_userid_required":
      return t("workspace.contacts.attributes_msg_email_or_userid_required");
    case "attribute_type_validation_error":
      return t("workspace.contacts.attributes_msg_attribute_type_validation_error", params);
    case "email_already_exists":
      return t("workspace.contacts.attributes_msg_email_already_exists");
    case "userid_already_exists":
      return t("workspace.contacts.attributes_msg_userid_already_exists");
    case "attribute_limit_exceeded":
      return t("workspace.contacts.attributes_msg_attribute_limit_exceeded", params);
    case "new_attribute_created":
      return t("workspace.contacts.attributes_msg_new_attribute_created", params);
    default:
      return code;
  }
};
