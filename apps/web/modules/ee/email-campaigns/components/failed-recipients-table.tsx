"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { CONTACTABILITY_REASONS } from "@formbricks/types/contactability";
import { formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { getEmailCampaignRecipientsAction } from "@/modules/ee/email-campaigns/actions";
import type { TPaginatedEmailCampaignFailures } from "@/modules/ee/email-campaigns/lib/campaign";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";

interface FailedRecipientsTableProps {
  workspaceId: string;
  campaignId: string;
  initialFailures: TPaginatedEmailCampaignFailures;
}

const CONTACTABILITY_REASON_TO_KEY: Record<string, string> = {
  [CONTACTABILITY_REASONS.COOLDOWN]: "results_reason_cooldown",
  [CONTACTABILITY_REASONS.FREQUENCY_DAY]: "results_reason_frequency_day",
  [CONTACTABILITY_REASONS.FREQUENCY_WEEK]: "results_reason_frequency_week",
  [CONTACTABILITY_REASONS.FREQUENCY_MONTH]: "results_reason_frequency_month",
  [CONTACTABILITY_REASONS.FREQUENCY_YEAR]: "results_reason_frequency_year",
  [CONTACTABILITY_REASONS.INCLUDED_SEGMENT]: "results_reason_included_segment",
  [CONTACTABILITY_REASONS.EXCLUDED_SEGMENT]: "results_reason_excluded_segment",
  [CONTACTABILITY_REASONS.PRIORITY]: "results_reason_priority",
  [CONTACTABILITY_REASONS.FATIGUE]: "results_reason_fatigue",
  "Contact not found": "results_reason_contact_not_found",
  "Contactability rules blocked send": "results_reason_contactability_blocked",
};

export const FailedRecipientsTable = ({
  workspaceId,
  campaignId,
  initialFailures,
}: Readonly<FailedRecipientsTableProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const [isPending, startTransition] = useTransition();

  const [failures, setFailures] = useState(initialFailures.data);
  const [page, setPage] = useState(initialFailures.page);
  const [total, setTotal] = useState(initialFailures.total);
  const [pageCount, setPageCount] = useState(initialFailures.pageCount);

  const loadPage = (pageNumber: number) => {
    startTransition(async () => {
      const result = await getEmailCampaignRecipientsAction({ workspaceId, campaignId, page: pageNumber });
      const payload = result?.data;
      if (!payload) return;

      setFailures(
        payload.data.map((failure) => ({
          ...failure,
          updatedAt: new Date(failure.updatedAt),
        }))
      );
      setTotal(payload.total);
      setPage(payload.page);
      setPageCount(payload.pageCount);
    });
  };

  const describeReason = (status: "skipped" | "failed", reason: string | null): string => {
    if (status === "skipped" && reason) {
      const key = CONTACTABILITY_REASON_TO_KEY[reason];
      if (key) {
        return t(`workspace.email_campaigns.${key}`);
      }
      return reason;
    }

    return reason || t("workspace.email_campaigns.results_reason_critical_error");
  };

  const fromRow = total === 0 ? 0 : (page - 1) * initialFailures.pageSize + 1;
  const toRow = Math.min(page * initialFailures.pageSize, total);
  const summary = t("workspace.email_campaigns.pagination_summary", {
    from: fromRow.toString(),
    to: toRow.toString(),
    total: total.toString(),
  });

  return (
    <div className="flex flex-col gap-4">
      {failures.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          {t("workspace.email_campaigns.results_empty_state")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">{t("workspace.email_campaigns.results_column_email")}</th>
                <th className="px-4 py-3">{t("workspace.email_campaigns.results_column_status")}</th>
                <th className="px-4 py-3">{t("workspace.email_campaigns.results_column_reason")}</th>
                <th className="px-4 py-3">{t("workspace.email_campaigns.results_column_updated_at")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {failures.map((failure) => (
                <tr key={failure.id}>
                  <td className="px-4 py-3 text-slate-700">
                    {failure.contactId ? (
                      <Link
                        href={`/workspaces/${workspaceId}/contacts/${failure.contactId}`}
                        className="text-slate-900 underline-offset-2 hover:underline">
                        {failure.email}
                      </Link>
                    ) : (
                      failure.email
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      text={t(`workspace.email_campaigns.results_status_${failure.status}`)}
                      type={failure.status === "failed" ? "error" : "warning"}
                      size="tiny"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {describeReason(failure.status, failure.reason)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                    {formatDateTimeForDisplay(new Date(failure.updatedAt), locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{summary}</p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={isPending || page <= 1}
            onClick={() => loadPage(page - 1)}>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <span className="min-w-20 text-center text-sm text-slate-600">
            {page} / {Math.max(pageCount, 1)}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={isPending || page >= pageCount}
            onClick={() => loadPage(page + 1)}>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
