import { accountSettingsPath } from "@/modules/settings/lib/routes";

export const buildLegacyNotificationsRedirect = (
  searchParams: Record<string, string | string[] | undefined>
): string => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      params.set(key, value);
    } else if (Array.isArray(value) && value[0]) {
      params.set(key, value[0]);
    }
  }

  const query = params.toString();
  return query ? `${accountSettingsPath("notifications")}?${query}` : accountSettingsPath("notifications");
};
