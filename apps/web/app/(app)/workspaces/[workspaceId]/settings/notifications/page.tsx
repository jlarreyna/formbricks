import { redirect } from "next/navigation";
import { buildLegacyNotificationsRedirect } from "./lib/legacy-notifications-redirect";

/**
 * Legacy email unsubscribe links pointed at /workspaces/.../settings/notifications.
 * Account notifications now live at /account/settings/notifications.
 */
const Page = async (
  props: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>
) => {
  const searchParams = await props.searchParams;
  redirect(buildLegacyNotificationsRedirect(searchParams));
};

export default Page;
