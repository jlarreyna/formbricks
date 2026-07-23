import { JOB_NAMES } from "@/src/constants";
import { type AnyBackgroundJobDefinition, toAnyBackgroundJobDefinition } from "@/src/contracts";
import { processEmailCampaignDispatchJob } from "@/src/processors/email-campaign-dispatch";
import { processEmailCampaignRecipientJob } from "@/src/processors/email-campaign-recipient";
import { processResponseAnalysisJob } from "@/src/processors/response-analysis";
import { processResponsePipelineJob } from "@/src/processors/response-pipeline";
import { processSurveySchedulingJob } from "@/src/processors/survey-scheduling";
import { processTestLogJob } from "@/src/processors/test-log";
import {
  ZEmailCampaignDispatchJobData,
  ZEmailCampaignRecipientJobData,
  ZResponseAnalysisJobData,
  ZResponsePipelineJobData,
  ZSurveySchedulingJobData,
  ZTestLogJobData,
} from "@/src/types";

export const backgroundJobDefinitions = {
  [JOB_NAMES.responsePipeline]: toAnyBackgroundJobDefinition({
    handle: processResponsePipelineJob,
    name: JOB_NAMES.responsePipeline,
    schema: ZResponsePipelineJobData,
  }),
  [JOB_NAMES.surveyScheduling]: toAnyBackgroundJobDefinition({
    handle: processSurveySchedulingJob,
    name: JOB_NAMES.surveyScheduling,
    schema: ZSurveySchedulingJobData,
  }),
  [JOB_NAMES.testLog]: toAnyBackgroundJobDefinition({
    handle: processTestLogJob,
    name: JOB_NAMES.testLog,
    schema: ZTestLogJobData,
  }),
  [JOB_NAMES.emailCampaignRecipient]: toAnyBackgroundJobDefinition({
    handle: processEmailCampaignRecipientJob,
    name: JOB_NAMES.emailCampaignRecipient,
    schema: ZEmailCampaignRecipientJobData,
  }),
  [JOB_NAMES.emailCampaignDispatch]: toAnyBackgroundJobDefinition({
    handle: processEmailCampaignDispatchJob,
    name: JOB_NAMES.emailCampaignDispatch,
    schema: ZEmailCampaignDispatchJobData,
  }),
  [JOB_NAMES.responseAnalysis]: toAnyBackgroundJobDefinition({
    handle: processResponseAnalysisJob,
    name: JOB_NAMES.responseAnalysis,
    schema: ZResponseAnalysisJobData,
  }),
} as const satisfies Record<string, AnyBackgroundJobDefinition>;

export type TBackgroundJobName = keyof typeof backgroundJobDefinitions;

export const getBackgroundJobDefinition = (jobName: string): AnyBackgroundJobDefinition | undefined =>
  backgroundJobDefinitions[jobName as TBackgroundJobName];
