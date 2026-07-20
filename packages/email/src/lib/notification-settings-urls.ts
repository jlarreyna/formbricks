export const getAccountNotificationSettingsUrl = (
  webAppUrl: string,
  type: "alert" | "unsubscribedOrganizationIds",
  elementId: string
): string => {
  const base = `${webAppUrl.replace(/\/$/, "")}/account/settings/notifications`;
  const params = new URLSearchParams({ type, elementId });
  return `${base}?${params.toString()}`;
};
