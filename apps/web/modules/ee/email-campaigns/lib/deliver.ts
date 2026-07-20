import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { getSurvey } from "@/lib/survey/service";
import { getWorkspace } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { buildSurveyEmailForContact } from "@/modules/ee/email-campaigns/lib/build-survey-email";
import { resolveContactIdsByEmail } from "@/modules/ee/email-campaigns/lib/contacts";
import { sendEmail } from "@/modules/email";

const EMBED_MODE_LOCALE = "default";

export class EmailCampaignDeliveryError extends Error {
  constructor(
    message: string,
    readonly unrecoverable: boolean = false
  ) {
    super(message);
    this.name = "EmailCampaignDeliveryError";
  }
}

export const finalizeCampaignIfDone = async (campaignId: string): Promise<void> => {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    select: { totalRecipients: true, sentCount: true, failedCount: true, status: true },
  });

  if (!campaign || campaign.status !== "processing") {
    return;
  }

  const processedCount = campaign.sentCount + campaign.failedCount;
  if (processedCount < campaign.totalRecipients) {
    return;
  }

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: { status: campaign.failedCount > 0 && campaign.sentCount === 0 ? "failed" : "completed" },
  });
};

export const markRecipientFailed = async (
  recipientId: string,
  campaignId: string,
  message: string
): Promise<void> => {
  const recipient = await prisma.emailCampaignRecipient.findUnique({
    where: { id: recipientId },
    select: { status: true },
  });
  if (!recipient || recipient.status !== "pending") {
    return;
  }

  await prisma.$transaction([
    prisma.emailCampaignRecipient.update({
      where: { id: recipientId },
      data: { status: "failed", error: message.slice(0, 500) },
    }),
    prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { failedCount: { increment: 1 } },
    }),
  ]);
};

/**
 * Delivers a single pending EmailCampaignRecipient. On success updates sent status.
 * On failure throws EmailCampaignDeliveryError without mutating recipient status —
 * callers decide when to mark failed (immediately for sync sends, after retries for jobs).
 */
export const deliverEmailCampaignRecipient = async (
  recipientId: string
): Promise<Result<{ campaignId: string }, ApiErrorResponseV2 | { type: "already_processed" }>> => {
  const recipient = await prisma.emailCampaignRecipient.findUnique({
    where: { id: recipientId },
    include: { campaign: true },
  });

  if (!recipient) {
    return err({
      type: "not_found",
      details: [{ field: "recipientId", issue: "not_found" }],
    });
  }

  if (recipient.status !== "pending") {
    return err({ type: "already_processed" });
  }

  const { campaign } = recipient;

  const [survey, workspace] = await Promise.all([
    getSurvey(campaign.surveyId),
    getWorkspace(campaign.workspaceId),
  ]);

  if (!survey || !workspace) {
    throw new EmailCampaignDeliveryError(`Survey or workspace not found for campaign ${campaign.id}`, true);
  }

  let contactId = recipient.contactId;
  if (!contactId) {
    const resolved = await resolveContactIdsByEmail(campaign.workspaceId, [recipient.email]);
    contactId = resolved.get(recipient.email.toLowerCase()) ?? null;
  }

  if (!contactId) {
    throw new EmailCampaignDeliveryError(`Unable to resolve a contact for recipient ${recipientId}`, true);
  }

  const t = await getTranslate(DEFAULT_LOCALE);
  const variables = { ...((recipient.variables as Record<string, string>) ?? {}) };
  if (!variables.email) {
    variables.email = recipient.email;
  }

  const emailResult = await buildSurveyEmailForContact({
    survey,
    workspace,
    contactId,
    mode: campaign.mode,
    hiddenFields: (recipient.hiddenFields as Record<string, string>) ?? {},
    variables,
    subject: campaign.subject,
    htmlTemplate: campaign.htmlTemplate,
    locale: EMBED_MODE_LOCALE,
    t,
  });

  if (!emailResult.ok) {
    throw new EmailCampaignDeliveryError(`Failed to build survey email: ${emailResult.error.type}`, true);
  }

  const sent = await sendEmail({
    to: recipient.email,
    subject: emailResult.data.subject,
    html: emailResult.data.html,
  });

  if (!sent) {
    throw new EmailCampaignDeliveryError("SMTP is not configured", true);
  }

  await prisma.$transaction([
    prisma.emailCampaignRecipient.update({
      where: { id: recipientId },
      data: { status: "sent", sentAt: new Date(), contactId, error: null },
    }),
    prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: { sentCount: { increment: 1 } },
    }),
  ]);

  await finalizeCampaignIfDone(campaign.id);
  return ok({ campaignId: campaign.id });
};

export const deliverEmailCampaignRecipientOrFail = async (
  recipientId: string
): Promise<Result<{ campaignId: string }, ApiErrorResponseV2>> => {
  try {
    const result = await deliverEmailCampaignRecipient(recipientId);
    if (!result.ok) {
      if (result.error.type === "already_processed") {
        const recipient = await prisma.emailCampaignRecipient.findUnique({
          where: { id: recipientId },
          select: { campaignId: true },
        });
        return recipient
          ? ok({ campaignId: recipient.campaignId })
          : err({
              type: "not_found",
              details: [{ field: "recipientId", issue: "not_found" }],
            });
      }
      return err(result.error);
    }
    return ok(result.data);
  } catch (error) {
    const recipient = await prisma.emailCampaignRecipient.findUnique({
      where: { id: recipientId },
      select: { campaignId: true },
    });
    if (recipient) {
      await markRecipientFailed(
        recipientId,
        recipient.campaignId,
        error instanceof Error ? error.message : "Unknown error"
      );
      await finalizeCampaignIfDone(recipient.campaignId);
    }
    logger.error({ err: error, recipientId }, "Synchronous email campaign delivery failed");
    return err({
      type: "internal_server_error",
      details: [{ field: "recipient", issue: error instanceof Error ? error.message : "Unknown error" }],
    });
  }
};
