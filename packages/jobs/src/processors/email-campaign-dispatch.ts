import { logger } from "@formbricks/logger";
import type { JobHandler } from "@/src/contracts";
import type { TEmailCampaignDispatchJobData } from "@/src/types";

export const processEmailCampaignDispatchJob: JobHandler<TEmailCampaignDispatchJobData> = (data, context) => {
  // TODO(#1548): Keep this fallback until every runtime that starts BullMQ registers the app override.
  logger.error(
    {
      attempt: context.attempt,
      campaignId: data.campaignId,
      jobId: context.jobId,
      jobName: context.jobName,
      queueName: context.queueName,
    },
    "BullMQ email campaign dispatch processor override is not registered"
  );

  throw new Error(
    `BullMQ email campaign dispatch processor override missing for job ${context.jobId} (${data.campaignId})`
  );
};
