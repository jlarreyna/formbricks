import { TFunction } from "i18next";
import { TEmailCampaignMode } from "@formbricks/types/email-campaigns";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { TSurvey } from "@formbricks/types/surveys/types";
import type { TWorkspace } from "@formbricks/types/workspace";
import { extractEmailBodyFragment } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/emailTemplateFragment";
import { toJsWorkspaceStateSurvey } from "@/lib/survey/client-utils";
import { getStyling } from "@/lib/utils/styling";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import {
  DEFAULT_EMAIL_CAMPAIGN_TEMPLATE,
  escapeHtml,
  interpolateTemplate,
} from "@/modules/ee/email-campaigns/lib/template";
import { getPreviewEmailTemplateHtml } from "@/modules/email/components/preview-email-template";

const PREVIEW_FLAG_PATTERNS = ["?preview=true&amp;", "?preview=true&", "?preview=true"];

const stripPreviewFlag = (html: string): string =>
  PREVIEW_FLAG_PATTERNS.reduce(
    (acc, pattern) => acc.replaceAll(pattern, pattern === "?preview=true" ? "" : "?"),
    html
  );

const buildDefaultLinkSurveyBlock = (surveyUrl: string, t: TFunction): string => {
  const label = escapeHtml(t("emails.verification_email_take_survey"));
  const href = escapeHtml(surveyUrl);
  return `<p style="margin:0;"><a href="${href}" style="display:inline-block;padding:12px 20px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;">${label}</a></p>`;
};

export interface TBuildSurveyEmailInput {
  survey: TSurvey;
  workspace: TWorkspace;
  contactId: string;
  mode: TEmailCampaignMode;
  hiddenFields: Record<string, string>;
  variables: Record<string, string>;
  subject: string;
  htmlTemplate: string | null | undefined;
  locale: string;
  t: TFunction;
}

/**
 * Builds a personalized survey invitation email for a single contact from a custom HTML template.
 * Placeholders: {{email}}, {{column}}, {{survey_link}}, {{survey}}.
 */
export const buildSurveyEmailForContact = async ({
  survey,
  workspace,
  contactId,
  mode,
  hiddenFields,
  variables,
  subject,
  htmlTemplate,
  locale,
  t,
}: TBuildSurveyEmailInput): Promise<Result<{ subject: string; html: string }, ApiErrorResponseV2>> => {
  const linkResult = await getContactSurveyLink(contactId, survey.id);
  if (!linkResult.ok) {
    return err(linkResult.error);
  }

  const surveyUrl = new URL(linkResult.data);
  for (const [key, value] of Object.entries(hiddenFields)) {
    surveyUrl.searchParams.set(key, value);
  }
  const surveyLink = surveyUrl.toString();

  let surveyBlock: string;
  if (mode === "link") {
    surveyBlock = buildDefaultLinkSurveyBlock(surveyLink, t);
  } else {
    const styling = getStyling(workspace, toJsWorkspaceStateSurvey(survey));
    const fullHtml = await getPreviewEmailTemplateHtml(survey, surveyLink, styling, locale, t);
    surveyBlock = stripPreviewFlag(extractEmailBodyFragment(fullHtml));
  }

  const scalars: Record<string, string> = {
    ...variables,
    email: variables.email ?? "",
    survey_link: surveyLink,
  };

  const template = htmlTemplate?.trim() ? htmlTemplate : DEFAULT_EMAIL_CAMPAIGN_TEMPLATE;

  const html = interpolateTemplate(template, {
    scalars,
    raw: { survey: surveyBlock },
  });

  const resolvedSubject = interpolateTemplate(subject, { scalars });

  return ok({ subject: resolvedSubject, html });
};
