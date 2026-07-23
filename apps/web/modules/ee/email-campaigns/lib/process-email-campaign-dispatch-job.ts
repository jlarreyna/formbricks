import "server-only";
import { prisma } from "@formbricks/database";
import {
  type JobHandler,
  type TEmailCampaignDispatchJobData,
  enqueueEmailCampaignRecipientJob,
} from "@formbricks/jobs";
import { logger } from "@formbricks/logger";

/**
 * Dispatches a scheduled EmailCampaign once its `scheduledAt` time is reached: flips the campaign
 * from `scheduled` to `processing` and enqueues the per-recipient delivery jobs. Registered as the
 * BullMQ handler override for `email-campaign.dispatch`.
 *
 * The conditional `updateMany` guarantees idempotency: if the campaign was already canceled,
 * rescheduled (and superseded by a new dispatch job), or already dispatched, this is a no-op.
 */
export const processEmailCampaignDispatchJob: JobHandler<TEmailCampaignDispatchJobData> = async (
  data,
  context
) => {
  const { campaignId } = data;

  const { count } = await prisma.emailCampaign.updateMany({
    where: { id: campaignId, status: "scheduled" },
    data: { status: "processing", dispatchJobId: null },
  });

  if (count === 0) {
    logger.info(
      { campaignId, jobId: context.jobId },
      "Email campaign dispatch skipped: campaign is no longer scheduled"
    );
    return;
  }

  const pendingRecipients = await prisma.emailCampaignRecipient.findMany({
    where: { campaignId, status: "pending" },
    select: { id: true },
  });

  await Promise.all(
    pendingRecipients.map(async (recipient) => {
      try {
        await enqueueEmailCampaignRecipientJob({ campaignId, recipientId: recipient.id });
      } catch (error) {
        logger.error(
          { err: error, campaignId, recipientId: recipient.id },
          "Failed to enqueue email campaign recipient job from dispatch"
        );
      }
    })
  );
};
