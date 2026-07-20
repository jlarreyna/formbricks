"use client";

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { Badge } from "@/modules/ui/components/badge";
import { getEmailCampaignsAction } from "../actions";
import type { TEmailCampaignListItem } from "../lib/campaign";

const POLL_INTERVAL_MS = 4000;

interface EmailCampaignListProps {
  workspaceId: string;
  campaigns: TEmailCampaignListItem[];
  onCampaignsChange: (campaigns: TEmailCampaignListItem[]) => void;
}

const statusBadgeType = (status: TEmailCampaignListItem["status"]): "success" | "error" | "warning" => {
  if (status === "completed") return "success";
  if (status === "failed") return "error";
  return "warning";
};

export const EmailCampaignList = ({ workspaceId, campaigns, onCampaignsChange }: EmailCampaignListProps) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const hasProcessingCampaign = campaigns.some((campaign) => campaign.status === "processing");
  const onCampaignsChangeRef = useRef(onCampaignsChange);
  onCampaignsChangeRef.current = onCampaignsChange;

  useEffect(() => {
    if (!hasProcessingCampaign) {
      return;
    }

    const intervalId = setInterval(() => {
      getEmailCampaignsAction({ workspaceId })
        .then((result) => {
          if (result?.data) {
            onCampaignsChangeRef.current(result.data);
          }
        })
        .catch(() => undefined);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [hasProcessingCampaign, workspaceId]);

  if (campaigns.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
        {t("workspace.email_campaigns.list_empty_state")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500 uppercase">
          <tr>
            <th className="px-4 py-3">{t("workspace.email_campaigns.list_column_name")}</th>
            <th className="px-4 py-3">{t("workspace.email_campaigns.list_column_survey")}</th>
            <th className="px-4 py-3">{t("workspace.email_campaigns.list_column_mode")}</th>
            <th className="px-4 py-3">{t("workspace.email_campaigns.list_column_source")}</th>
            <th className="px-4 py-3">{t("workspace.email_campaigns.list_column_sent_at")}</th>
            <th className="px-4 py-3">{t("workspace.email_campaigns.list_column_progress")}</th>
            <th className="px-4 py-3">{t("workspace.email_campaigns.list_column_status")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {campaigns.map((campaign) => {
            const processedCount = campaign.sentCount + campaign.failedCount;
            return (
              <tr key={campaign.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{campaign.name || campaign.subject}</p>
                  <p className="text-xs text-slate-500">{campaign.subject}</p>
                </td>
                <td className="px-4 py-3 text-slate-700">{campaign.survey.name}</td>
                <td className="px-4 py-3 text-slate-700">
                  {campaign.mode === "embed"
                    ? t("workspace.email_campaigns.form_mode_embed")
                    : t("workspace.email_campaigns.form_mode_link")}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {campaign.source === "api"
                    ? t("workspace.email_campaigns.list_source_api")
                    : campaign.source === "transactional"
                      ? t("workspace.email_campaigns.list_source_transactional")
                      : t("workspace.email_campaigns.list_source_ui")}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                  {formatDateTimeForDisplay(new Date(campaign.createdAt), locale)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {t("workspace.email_campaigns.list_progress", {
                    processed: processedCount,
                    total: campaign.totalRecipients,
                    failed: campaign.failedCount,
                  })}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    text={t(`workspace.email_campaigns.status_${campaign.status}`)}
                    type={statusBadgeType(campaign.status)}
                    size="tiny"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
