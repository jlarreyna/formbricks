import {
  MAX_EMAIL_CAMPAIGN_RECIPIENTS,
  TEmailCampaignRecipientInput,
} from "@formbricks/types/email-campaigns";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { getSurvey } from "@/lib/survey/service";
import { TEmailCampaignApiCreateInput } from "@/modules/api/v2/management/email-campaigns/types/email-campaigns";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { parseEmailCampaignCsv } from "@/modules/ee/email-campaigns/lib/csv";

/**
 * Resolves the final recipient list for an API-created campaign, merging any inline JSON
 * `recipients` with recipients parsed out of a raw `csv` string (using the target survey's hidden
 * field ids to decide which CSV columns to keep), and enforces the max recipient count.
 */
export const resolveEmailCampaignApiRecipients = async (
  input: TEmailCampaignApiCreateInput
): Promise<Result<TEmailCampaignRecipientInput[], ApiErrorResponseV2>> => {
  const survey = await getSurvey(input.surveyId);
  if (!survey || survey.workspaceId !== input.workspaceId) {
    return err({
      type: "not_found",
      details: [{ field: "surveyId", issue: "not_found" }],
    });
  }

  const recipients: TEmailCampaignRecipientInput[] = [...(input.recipients ?? [])];

  if (input.csv?.trim()) {
    const allowedHiddenFieldIds = survey.hiddenFields.enabled ? (survey.hiddenFields.fieldIds ?? []) : [];

    let csvResult: ReturnType<typeof parseEmailCampaignCsv>;
    try {
      csvResult = parseEmailCampaignCsv(input.csv, allowedHiddenFieldIds);
    } catch {
      return err({
        type: "bad_request",
        details: [{ field: "csv", issue: "Unable to parse CSV" }],
      });
    }

    recipients.push(...csvResult.recipients);
  }

  if (recipients.length === 0) {
    return err({
      type: "bad_request",
      details: [{ field: "recipients", issue: "at least one valid recipient is required" }],
    });
  }

  if (recipients.length > MAX_EMAIL_CAMPAIGN_RECIPIENTS) {
    return err({
      type: "bad_request",
      details: [
        {
          field: "recipients",
          issue: `too many recipients: max ${MAX_EMAIL_CAMPAIGN_RECIPIENTS} per campaign`,
        },
      ],
    });
  }

  return ok(recipients);
};
