import { TUserNotificationSettings } from "@formbricks/types/user";

/**
 * Toggles organization auto-subscribe. When unsubscribing, also disables every-response
 * alerts for surveys that belong to that organization so existing surveys stop emailing.
 * Re-subscribing only removes the org from the unsubscribe list (does not re-enable alerts).
 */
export const toggleOrganizationAutoSubscribe = (
  notificationSettings: TUserNotificationSettings,
  organizationId: string,
  organizationSurveyIds: string[]
): TUserNotificationSettings => {
  const unsubscribedOrganizationIds = notificationSettings.unsubscribedOrganizationIds ?? [];
  const isCurrentlyUnsubscribed = unsubscribedOrganizationIds.includes(organizationId);

  if (isCurrentlyUnsubscribed) {
    return {
      ...notificationSettings,
      alert: { ...notificationSettings.alert },
      unsubscribedOrganizationIds: unsubscribedOrganizationIds.filter((id) => id !== organizationId),
    };
  }

  const alert = { ...notificationSettings.alert };
  for (const surveyId of organizationSurveyIds) {
    alert[surveyId] = false;
  }

  return {
    ...notificationSettings,
    alert,
    unsubscribedOrganizationIds: [...unsubscribedOrganizationIds, organizationId],
  };
};

export const toggleSurveyAlert = (
  notificationSettings: TUserNotificationSettings,
  surveyId: string
): TUserNotificationSettings => {
  return {
    ...notificationSettings,
    alert: {
      ...notificationSettings.alert,
      [surveyId]: !notificationSettings.alert?.[surveyId],
    },
    unsubscribedOrganizationIds: notificationSettings.unsubscribedOrganizationIds,
  };
};

export const getOrganizationSurveyIds = (
  memberships: Array<{
    organization: {
      id: string;
      workspaces: Array<{ surveys: Array<{ id: string }> }>;
    };
  }>,
  organizationId: string
): string[] => {
  const membership = memberships.find((item) => item.organization.id === organizationId);
  if (!membership) {
    return [];
  }

  return membership.organization.workspaces.flatMap((workspace) =>
    workspace.surveys.map((survey) => survey.id)
  );
};
