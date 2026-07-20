import { logger } from "@formbricks/logger";
import type { JobHandler } from "@/src/contracts";
import type { TEmailCampaignRecipientJobData } from "@/src/types";

export const processEmailCampaignRecipientJob: JobHandler<TEmailCampaignRecipientJobData> = (
  data,
  context
) => {
  // TODO(#1548): Keep this fallback until every runtime that starts BullMQ registers the app override.
  logger.error(
    {
      attempt: context.attempt,
      campaignId: data.campaignId,
      recipientId: data.recipientId,
      jobId: context.jobId,
      jobName: context.jobName,
      queueName: context.queueName,
    },
    "BullMQ email campaign recipient processor override is not registered"
  );

  throw new Error(
    `BullMQ email campaign recipient processor override missing for job ${context.jobId} (${data.campaignId}/${data.recipientId})`
  );
};
