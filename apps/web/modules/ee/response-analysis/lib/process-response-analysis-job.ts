import "server-only";
import { prisma } from "@formbricks/database";
import { type JobHandler, type TResponseAnalysisJobData, UnrecoverableError } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { ZResponseAnalysisPayload, toResponseAnalysisColumns } from "@formbricks/types/response-analysis";
import { generateInstanceAIObject } from "@/lib/ai/service";
import { getSurvey } from "@/lib/survey/service";
import { buildResponseAnalysisPrompt } from "@/modules/ee/response-analysis/lib/build-analysis-prompt";

const RESPONSE_ANALYSIS_TIMEOUT_MS = 45_000;

/**
 * Analyzes a single finished survey response with an LLM (sentiment, severity, categories,
 * recommended routing, etc) and persists the structured result on ResponseAnalysis. Registered
 * as the real BullMQ handler override for `response-analysis.process` in
 * apps/web/instrumentation-jobs.ts. Enqueued from the response pipeline only when AI is
 * configured at the instance level (see runResponseFinishedSideEffects).
 */
export const processResponseAnalysisJob: JobHandler<TResponseAnalysisJobData> = async (data, context) => {
  const { responseId, surveyId } = data;

  // Idempotent: a previous attempt (or a duplicate enqueue) may have already produced an analysis.
  const existingAnalysis = await prisma.responseAnalysis.findUnique({
    where: { responseId },
    select: { id: true },
  });

  if (existingAnalysis) {
    return;
  }

  const [response, survey] = await Promise.all([
    prisma.response.findUnique({
      where: { id: responseId },
      select: { id: true, surveyId: true, data: true, finished: true },
    }),
    getSurvey(surveyId),
  ]);

  if (!response || !survey) {
    throw new UnrecoverableError(`Response ${responseId} or survey ${surveyId} not found`);
  }

  if (response.surveyId !== surveyId) {
    throw new UnrecoverableError(`Response ${responseId} does not belong to survey ${surveyId}`);
  }

  if (!response.finished) {
    // Should not happen (only enqueued on responseFinished), but guards against stale/duplicate jobs.
    return;
  }

  const prompt = buildResponseAnalysisPrompt(survey, response.data);

  if (!prompt.hasContent) {
    logger.info(
      { responseId, surveyId, jobId: context.jobId },
      "Response has no analyzable content; skipping AI analysis"
    );
    return;
  }

  try {
    const result = await generateInstanceAIObject({
      schema: ZResponseAnalysisPayload,
      system: prompt.system,
      prompt: prompt.user,
      temperature: 0,
      timeout: RESPONSE_ANALYSIS_TIMEOUT_MS,
    });

    const columns = toResponseAnalysisColumns(result.object);
    const data = { data: result.object, ...columns };

    await prisma.responseAnalysis.upsert({
      where: { responseId },
      create: { responseId, ...data },
      update: data,
    });
  } catch (error) {
    logger.error(
      { err: error, responseId, surveyId, jobId: context.jobId, attempt: context.attempt },
      "Failed to generate response analysis"
    );
    throw error;
  }
};
