import { prisma } from "@formbricks/database";
import { enqueueEmailCampaignRecipientJob } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import {
  TEmailCampaignMode,
  TEmailCampaignRecipientInput,
  TEmailCampaignSource,
} from "@formbricks/types/email-campaigns";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { getSurvey } from "@/lib/survey/service";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { getContactAttributes } from "@/modules/ee/contacts/lib/contact-attributes";
import { getContact } from "@/modules/ee/contacts/lib/contacts";
import { resolveContactIdsByEmail } from "@/modules/ee/email-campaigns/lib/contacts";
import { deliverEmailCampaignRecipientOrFail } from "@/modules/ee/email-campaigns/lib/deliver";
import { resolveCampaignHtmlTemplate } from "@/modules/ee/email-campaigns/lib/templates";
import { IS_SMTP_CONFIGURED } from "@/modules/email";

export interface TCreateEmailCampaignInput {
  workspaceId: string;
  surveyId: string;
  mode: TEmailCampaignMode;
  subject: string;
  name?: string;
  templateId?: string;
  recipients: Array<TEmailCampaignRecipientInput & { contactId?: string }>;
  source: TEmailCampaignSource;
  createdBy?: string;
  /** When true, deliver the single recipient synchronously instead of enqueueing. */
  deliverSynchronously?: boolean;
}

export interface TEmailCampaignListItem {
  id: string;
  name: string | null;
  subject: string;
  mode: TEmailCampaignMode;
  status: "processing" | "completed" | "failed";
  source: TEmailCampaignSource;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: Date;
  survey: { id: string; name: string };
}

const dedupeRecipientsByEmail = (
  recipients: Array<TEmailCampaignRecipientInput & { contactId?: string }>
): Array<TEmailCampaignRecipientInput & { contactId?: string }> => {
  const byEmail = new Map<string, TEmailCampaignRecipientInput & { contactId?: string }>();
  for (const recipient of recipients) {
    byEmail.set(recipient.email.trim().toLowerCase(), recipient);
  }
  return [...byEmail.values()];
};

const toListItem = (
  campaign: {
    id: string;
    name: string | null;
    subject: string;
    mode: TEmailCampaignMode;
    status: "processing" | "completed" | "failed";
    source: TEmailCampaignSource;
    totalRecipients: number;
    sentCount: number;
    failedCount: number;
    createdAt: Date;
  },
  survey: { id: string; name: string }
): TEmailCampaignListItem => ({
  id: campaign.id,
  name: campaign.name,
  subject: campaign.subject,
  mode: campaign.mode,
  status: campaign.status,
  source: campaign.source,
  totalRecipients: campaign.totalRecipients,
  sentCount: campaign.sentCount,
  failedCount: campaign.failedCount,
  createdAt: campaign.createdAt,
  survey: { id: survey.id, name: survey.name },
});

export const createEmailCampaign = async (
  input: TCreateEmailCampaignInput
): Promise<Result<TEmailCampaignListItem, ApiErrorResponseV2>> => {
  if (!IS_SMTP_CONFIGURED) {
    return err({
      type: "bad_request",
      details: [{ field: "smtp", issue: "SMTP is not configured on this instance" }],
    });
  }

  const survey = await getSurvey(input.surveyId);
  if (!survey || survey.workspaceId !== input.workspaceId) {
    return err({
      type: "not_found",
      details: [{ field: "surveyId", issue: "not_found" }],
    });
  }

  const recipients = dedupeRecipientsByEmail(input.recipients);
  if (recipients.length === 0) {
    return err({
      type: "bad_request",
      details: [{ field: "recipients", issue: "at least one valid recipient is required" }],
    });
  }

  if (input.deliverSynchronously && recipients.length !== 1) {
    return err({
      type: "bad_request",
      details: [{ field: "recipients", issue: "synchronous delivery requires exactly one recipient" }],
    });
  }

  const allowedHiddenFieldIds = new Set(
    survey.hiddenFields.enabled ? (survey.hiddenFields.fieldIds ?? []) : []
  );
  const { html, templateId } = await resolveCampaignHtmlTemplate(input.workspaceId, input.templateId);

  try {
    const emailToContactId = await resolveContactIdsByEmail(
      input.workspaceId,
      recipients.map((recipient) => recipient.email)
    );

    const campaign = await prisma.emailCampaign.create({
      data: {
        workspaceId: input.workspaceId,
        surveyId: input.surveyId,
        subject: input.subject,
        name: input.name,
        mode: input.mode,
        source: input.source,
        createdBy: input.createdBy,
        totalRecipients: recipients.length,
        htmlTemplate: html,
        templateId,
      },
    });

    const createdRecipients = await prisma.emailCampaignRecipient.createManyAndReturn({
      data: recipients.map((recipient) => {
        const email = recipient.email.trim().toLowerCase();
        const variables: Record<string, string> = {
          ...(recipient.variables ?? {}),
          email,
        };
        const hiddenFields = Object.fromEntries(
          Object.entries(recipient.hiddenFields ?? {}).filter(([fieldId]) =>
            allowedHiddenFieldIds.has(fieldId)
          )
        );

        // Also promote variable keys that match hidden field ids.
        for (const [key, value] of Object.entries(variables)) {
          if (allowedHiddenFieldIds.has(key) && !hiddenFields[key]) {
            hiddenFields[key] = value;
          }
        }

        return {
          campaignId: campaign.id,
          contactId: recipient.contactId ?? emailToContactId.get(email) ?? null,
          email,
          variables,
          hiddenFields,
        };
      }),
      select: { id: true },
    });

    if (input.deliverSynchronously) {
      await deliverEmailCampaignRecipientOrFail(createdRecipients[0].id);
      const refreshed = await prisma.emailCampaign.findUniqueOrThrow({
        where: { id: campaign.id },
        select: {
          id: true,
          name: true,
          subject: true,
          mode: true,
          status: true,
          source: true,
          totalRecipients: true,
          sentCount: true,
          failedCount: true,
          createdAt: true,
        },
      });

      return ok(toListItem(refreshed, { id: survey.id, name: survey.name }));
    }

    await Promise.all(
      createdRecipients.map(async (recipient) => {
        try {
          await enqueueEmailCampaignRecipientJob({ campaignId: campaign.id, recipientId: recipient.id });
        } catch (error) {
          logger.error(
            { err: error, campaignId: campaign.id, recipientId: recipient.id },
            "Failed to enqueue email campaign recipient job"
          );
        }
      })
    );

    return ok(toListItem(campaign, { id: survey.id, name: survey.name }));
  } catch (error) {
    logger.error({ err: error, workspaceId: input.workspaceId }, "Failed to create email campaign");
    return err({
      type: "internal_server_error",
      details: [{ field: "campaign", issue: error instanceof Error ? error.message : "Unknown error" }],
    });
  }
};

export const sendTransactionalEmailToContact = async (input: {
  workspaceId: string;
  contactId: string;
  surveyId: string;
  mode: TEmailCampaignMode;
  subject: string;
  templateId?: string;
  createdBy?: string;
}): Promise<Result<TEmailCampaignListItem, ApiErrorResponseV2>> => {
  const contact = await getContact(input.contactId);
  if (!contact || contact.workspaceId !== input.workspaceId) {
    return err({
      type: "not_found",
      details: [{ field: "contactId", issue: "not_found" }],
    });
  }

  const attributes = await getContactAttributes(input.contactId);
  const email = typeof attributes.email === "string" ? attributes.email.trim().toLowerCase() : "";
  if (!email) {
    return err({
      type: "bad_request",
      details: [{ field: "contactId", issue: "contact has no email attribute" }],
    });
  }

  const survey = await getSurvey(input.surveyId);
  if (!survey || survey.workspaceId !== input.workspaceId) {
    return err({
      type: "not_found",
      details: [{ field: "surveyId", issue: "not_found" }],
    });
  }

  const allowedHiddenFieldIds = new Set(
    survey.hiddenFields.enabled ? (survey.hiddenFields.fieldIds ?? []) : []
  );
  const variables: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (typeof value === "string") {
      variables[key] = value;
    } else if (value != null) {
      variables[key] = String(value);
    }
  }
  variables.email = email;

  const hiddenFields = Object.fromEntries(
    Object.entries(variables).filter(([fieldId]) => allowedHiddenFieldIds.has(fieldId))
  );

  return createEmailCampaign({
    workspaceId: input.workspaceId,
    surveyId: input.surveyId,
    mode: input.mode,
    subject: input.subject,
    templateId: input.templateId,
    recipients: [{ email, variables, hiddenFields, contactId: input.contactId }],
    source: "transactional",
    createdBy: input.createdBy,
    deliverSynchronously: true,
  });
};

export const getEmailCampaigns = async (workspaceId: string): Promise<TEmailCampaignListItem[]> => {
  const campaigns = await prisma.emailCampaign.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      subject: true,
      mode: true,
      status: true,
      source: true,
      totalRecipients: true,
      sentCount: true,
      failedCount: true,
      createdAt: true,
      survey: { select: { id: true, name: true } },
    },
  });

  return campaigns;
};
