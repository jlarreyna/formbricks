"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TUserNotificationSettings } from "@formbricks/types/user";
import { Switch } from "@/modules/ui/components/switch";
import { toggleOrganizationAutoSubscribe, toggleSurveyAlert } from "../lib/notification-settings";

interface NotificationSwitchProps {
  surveyOrWorkspaceOrOrganizationId: string;
  notificationSettings: TUserNotificationSettings;
  persistNotificationSettings: (
    compute: (current: TUserNotificationSettings) => TUserNotificationSettings
  ) => Promise<boolean>;
  notificationType: "alert" | "unsubscribedOrganizationIds";
  /** Survey IDs in the org; required when toggling organization auto-subscribe off. */
  organizationSurveyIds?: string[];
  autoDisableNotificationType?: string;
  autoDisableNotificationElementId?: string;
}

export const NotificationSwitch = ({
  surveyOrWorkspaceOrOrganizationId,
  notificationSettings,
  persistNotificationSettings,
  notificationType,
  organizationSurveyIds = [],
  autoDisableNotificationType,
  autoDisableNotificationElementId,
}: NotificationSwitchProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();
  const router = useRouter();
  const isChecked =
    notificationType === "unsubscribedOrganizationIds"
      ? !notificationSettings.unsubscribedOrganizationIds?.includes(surveyOrWorkspaceOrOrganizationId)
      : notificationSettings[notificationType]?.[surveyOrWorkspaceOrOrganizationId] === true;

  const handleSwitchChange = async () => {
    if (isLoading) {
      return;
    }

    setIsLoading(true);

    await persistNotificationSettings((current) =>
      notificationType === "unsubscribedOrganizationIds"
        ? toggleOrganizationAutoSubscribe(current, surveyOrWorkspaceOrOrganizationId, organizationSurveyIds)
        : toggleSurveyAlert(current, surveyOrWorkspaceOrOrganizationId)
    );

    // Refresh from server after success or failure so UI matches persisted settings.
    router.refresh();
    setIsLoading(false);
  };

  useEffect(() => {
    if (
      autoDisableNotificationType &&
      autoDisableNotificationElementId === surveyOrWorkspaceOrOrganizationId &&
      isChecked
    ) {
      switch (notificationType) {
        case "alert":
          if (notificationSettings[notificationType]?.[surveyOrWorkspaceOrOrganizationId] === true) {
            void handleSwitchChange().then(() => {
              toast.success(
                t(
                  "workspace.settings.notifications.you_will_not_receive_any_more_emails_for_responses_on_this_survey"
                ),
                {
                  id: "notification-switch-auto-disable",
                }
              );
            });
          }
          break;

        case "unsubscribedOrganizationIds":
          if (
            !notificationSettings.unsubscribedOrganizationIds?.includes(surveyOrWorkspaceOrOrganizationId)
          ) {
            void handleSwitchChange().then(() => {
              toast.success(
                t(
                  "workspace.settings.notifications.you_will_not_be_auto_subscribed_to_this_organizations_surveys_anymore"
                ),
                {
                  id: "notification-switch-auto-disable",
                }
              );
            });
          }
          break;

        default:
          break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Switch
      id={`notification-switch-${notificationType}-${surveyOrWorkspaceOrOrganizationId}`}
      aria-label={`toggle notification settings for ${notificationType} ${surveyOrWorkspaceOrOrganizationId}`}
      checked={isChecked}
      disabled={isLoading}
      onCheckedChange={() => {
        void handleSwitchChange();
      }}
    />
  );
};
