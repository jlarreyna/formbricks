import { prisma } from "@/lib/__mocks__/database";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { processResponseAnalysisJob } from "./process-response-analysis-job";

const { mockGenerateInstanceAIObject, mockGetSurvey, mockLoggerError, mockLoggerInfo } = vi.hoisted(() => ({
  mockGenerateInstanceAIObject: vi.fn(),
  mockGetSurvey: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerInfo: vi.fn(),
}));

vi.mock("@formbricks/jobs", () => ({
  UnrecoverableError: class UnrecoverableError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "UnrecoverableError";
    }
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mockLoggerError,
    info: mockLoggerInfo,
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/ai/service", () => ({
  generateInstanceAIObject: mockGenerateInstanceAIObject,
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: mockGetSurvey,
}));

const baseContext = {
  attempt: 1,
  jobId: "job_123",
  jobName: "response-analysis.process",
  maxAttempts: 3,
  queueName: "background-jobs",
};

const jobData = {
  responseId: "response_123",
  surveyId: "survey_123",
  workspaceId: "workspace_123",
  organizationId: "org_123",
};

const survey = {
  id: "survey_123",
  blocks: [
    {
      elements: [{ id: "el-1", type: "openText", headline: { default: "How can we improve?" } }],
    },
  ],
} as unknown as TSurvey;

const response = {
  id: "response_123",
  surveyId: "survey_123",
  data: { "el-1": "Faster shipping please" },
  finished: true,
};

const llmPayload = {
  sentiment: "negative" as const,
  sentiment_score: -0.6,
  severity: "medium" as const,
  confidence: 0.8,
  categories: ["logística"],
  topics: ["envíos"],
  keywords: ["envío", "lento"],
  emotion: "Frustración",
  customer_effort: "high" as const,
  requires_followup: true,
  recommended_department: "Logística",
  recommended_priority: "Alta",
  summary: "El cliente pide envíos más rápidos.",
};

describe("processResponseAnalysisJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.responseAnalysis.findUnique.mockResolvedValue(null as never);
    prisma.response.findUnique.mockResolvedValue(response as never);
    mockGetSurvey.mockResolvedValue(survey);
    mockGenerateInstanceAIObject.mockResolvedValue({ object: llmPayload } as never);
    prisma.responseAnalysis.upsert.mockResolvedValue({} as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("is idempotent when an analysis already exists for the response", async () => {
    prisma.responseAnalysis.findUnique.mockResolvedValue({ id: "analysis_1" } as never);

    await expect(processResponseAnalysisJob(jobData, baseContext)).resolves.toBeUndefined();

    expect(prisma.response.findUnique).not.toHaveBeenCalled();
    expect(mockGetSurvey).not.toHaveBeenCalled();
    expect(mockGenerateInstanceAIObject).not.toHaveBeenCalled();
    expect(prisma.responseAnalysis.upsert).not.toHaveBeenCalled();
  });

  test("throws an unrecoverable error when the response cannot be found", async () => {
    prisma.response.findUnique.mockResolvedValue(null as never);

    await expect(processResponseAnalysisJob(jobData, baseContext)).rejects.toThrow(
      `Response ${jobData.responseId} or survey ${jobData.surveyId} not found`
    );
    expect(mockGenerateInstanceAIObject).not.toHaveBeenCalled();
  });

  test("throws an unrecoverable error when the survey cannot be found", async () => {
    mockGetSurvey.mockResolvedValue(null);

    await expect(processResponseAnalysisJob(jobData, baseContext)).rejects.toThrow(
      `Response ${jobData.responseId} or survey ${jobData.surveyId} not found`
    );
    expect(mockGenerateInstanceAIObject).not.toHaveBeenCalled();
  });

  test("throws an unrecoverable error when the response does not belong to the given survey", async () => {
    prisma.response.findUnique.mockResolvedValue({ ...response, surveyId: "other_survey" } as never);

    await expect(processResponseAnalysisJob(jobData, baseContext)).rejects.toThrow(
      `Response ${jobData.responseId} does not belong to survey ${jobData.surveyId}`
    );
    expect(mockGenerateInstanceAIObject).not.toHaveBeenCalled();
  });

  test("skips analysis for a response that is not finished (stale/duplicate job)", async () => {
    prisma.response.findUnique.mockResolvedValue({ ...response, finished: false } as never);

    await expect(processResponseAnalysisJob(jobData, baseContext)).resolves.toBeUndefined();

    expect(mockGenerateInstanceAIObject).not.toHaveBeenCalled();
    expect(prisma.responseAnalysis.upsert).not.toHaveBeenCalled();
  });

  test("skips the LLM call when the response has no answerable content", async () => {
    prisma.response.findUnique.mockResolvedValue({ ...response, data: {} } as never);

    await expect(processResponseAnalysisJob(jobData, baseContext)).resolves.toBeUndefined();

    expect(mockGenerateInstanceAIObject).not.toHaveBeenCalled();
    expect(prisma.responseAnalysis.upsert).not.toHaveBeenCalled();
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ responseId: "response_123", surveyId: "survey_123" }),
      "Response has no analyzable content; skipping AI analysis"
    );
  });

  test("maps the LLM snake_case payload onto camelCase columns and upserts the analysis", async () => {
    await expect(processResponseAnalysisJob(jobData, baseContext)).resolves.toBeUndefined();

    expect(mockGenerateInstanceAIObject).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("canonical English enum values"),
        prompt: expect.stringContaining("Q: How can we improve?\nA: Faster shipping please"),
        temperature: 0,
      })
    );

    const expectedColumns = {
      sentiment: "negative",
      sentimentScore: -0.6,
      severity: "medium",
      confidence: 0.8,
      categories: ["logística"],
      topics: ["envíos"],
      keywords: ["envío", "lento"],
      emotion: "Frustración",
      customerEffort: "high",
      requiresFollowup: true,
      recommendedDepartment: "Logística",
      recommendedPriority: "Alta",
      summary: "El cliente pide envíos más rápidos.",
    };

    expect(prisma.responseAnalysis.upsert).toHaveBeenCalledWith({
      where: { responseId: "response_123" },
      create: { responseId: "response_123", data: llmPayload, ...expectedColumns },
      update: { data: llmPayload, ...expectedColumns },
    });
  });

  test("logs and rethrows when the LLM call fails so BullMQ can retry", async () => {
    const aiError = new Error("provider unavailable");
    mockGenerateInstanceAIObject.mockRejectedValue(aiError);

    await expect(processResponseAnalysisJob(jobData, baseContext)).rejects.toThrow("provider unavailable");

    expect(prisma.responseAnalysis.upsert).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: aiError,
        responseId: "response_123",
        surveyId: "survey_123",
        jobId: "job_123",
        attempt: 1,
      }),
      "Failed to generate response analysis"
    );
  });
});
