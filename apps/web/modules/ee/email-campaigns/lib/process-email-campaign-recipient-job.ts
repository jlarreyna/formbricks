import "server-only";
import { prisma } from "@formbricks/database";
import { type JobHandler, type TEmailCampaignRecipientJobData, UnrecoverableError } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import {
  EmailCampaignDeliveryError,
  deliverEmailCampaignRecipient,
  finalizeCampaignIfDone,
  markRecipientFailed,
} from "@/modules/ee/email-campaigns/lib/deliver";

/**
 * Processes a single EmailCampaignRecipient via the shared delivery core.
 * Registered as the BullMQ handler override for `email-campaign-recipient.process`.
 */
export const processEmailCampaignRecipientJob: JobHandler<TEmailCampaignRecipientJobData> = async (
  data,
  context
) => {
  const { campaignId, recipientId } = data;

  const recipient = await prisma.emailCampaignRecipient.findUnique({
    where: { id: recipientId },
    select: { id: true, campaignId: true, status: true },
  });

  if (!recipient || recipient.campaignId !== campaignId) {
    logger.warn({ campaignId, recipientId, jobId: context.jobId }, "Email campaign recipient not found");
    return;
  }

  if (recipient.status !== "pending") {
    return;
  }

  try {
    const result = await deliverEmailCampaignRecipient(recipientId);
    if (!result.ok && result.error.type === "already_processed") {
      return;
    }
    if (!result.ok) {
      if (result.error.type === "already_processed") {
        return;
      }
      throw new UnrecoverableError(
        "details" in result.error && result.error.details?.[0]?.issue
          ? result.error.details[0].issue
          : result.error.type
      );
    }
  } catch (error) {
    logger.error(
      { err: error, campaignId, recipientId, jobId: context.jobId, attempt: context.attempt },
      "Failed to process email campaign recipient"
    );

    const isUnrecoverable =
      error instanceof UnrecoverableError ||
      (error instanceof EmailCampaignDeliveryError && error.unrecoverable);

    if (context.attempt >= context.maxAttempts || isUnrecoverable) {
      await markRecipientFailed(
        recipientId,
        campaignId,
        error instanceof Error ? error.message : "Unknown error"
      );
      await finalizeCampaignIfDone(campaignId);
    }

    if (isUnrecoverable && !(error instanceof UnrecoverableError)) {
      throw new UnrecoverableError(error instanceof Error ? error.message : "Unknown error");
    }

    throw error;
  }
};
