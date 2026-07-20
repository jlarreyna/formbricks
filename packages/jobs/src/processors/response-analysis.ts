import { logger } from "@formbricks/logger";
import type { JobHandler } from "@/src/contracts";
import type { TResponseAnalysisJobData } from "@/src/types";

export const processResponseAnalysisJob: JobHandler<TResponseAnalysisJobData> = (data, context) => {
  // TODO(#1548): Keep this fallback until every runtime that starts BullMQ registers the app override.
  logger.error(
    {
      attempt: context.attempt,
      responseId: data.responseId,
      surveyId: data.surveyId,
      workspaceId: data.workspaceId,
      jobId: context.jobId,
      jobName: context.jobName,
      queueName: context.queueName,
    },
    "BullMQ response analysis processor override is not registered"
  );

  throw new Error(
    `BullMQ response analysis processor override missing for job ${context.jobId} (${data.responseId})`
  );
};
