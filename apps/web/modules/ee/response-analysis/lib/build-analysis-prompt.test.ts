import { describe, expect, test } from "vitest";
import type { TResponseData } from "@formbricks/types/responses";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { buildResponseAnalysisPrompt } from "./build-analysis-prompt";

const surveyWithElements = (elements: unknown[]): TSurvey =>
  ({
    id: "survey-1",
    blocks: [{ elements }],
  }) as unknown as TSurvey;

describe("buildResponseAnalysisPrompt", () => {
  test("pairs each answered question with its answer and reports hasContent", () => {
    const survey = surveyWithElements([
      { id: "el-1", type: "openText", headline: { default: "How can we improve?" } },
      { id: "el-2", type: "nps", headline: { default: "How likely to recommend?" } },
    ]);
    const responseData: TResponseData = { "el-1": "Faster shipping please", "el-2": 8 };

    const prompt = buildResponseAnalysisPrompt(survey, responseData);

    expect(prompt.hasContent).toBe(true);
    expect(prompt.user).toBe(
      "Survey response to analyze:\n\n" +
        "Q: How can we improve?\nA: Faster shipping please\n\n" +
        "Q: How likely to recommend?\nA: 8"
    );
  });

  test("preserves element order from the survey blocks", () => {
    const survey = surveyWithElements([
      { id: "el-1", type: "openText", headline: { default: "First question" } },
      { id: "el-2", type: "openText", headline: { default: "Second question" } },
      { id: "el-3", type: "openText", headline: { default: "Third question" } },
    ]);
    const responseData: TResponseData = {
      "el-3": "third answer",
      "el-1": "first answer",
      "el-2": "second answer",
    };

    const prompt = buildResponseAnalysisPrompt(survey, responseData);

    expect(prompt.user).toBe(
      "Survey response to analyze:\n\n" +
        "Q: First question\nA: first answer\n\n" +
        "Q: Second question\nA: second answer\n\n" +
        "Q: Third question\nA: third answer"
    );
  });

  test("skips elements without a recorded answer (skipped questions, hidden fields)", () => {
    const survey = surveyWithElements([
      { id: "el-1", type: "openText", headline: { default: "Answered" } },
      { id: "el-2", type: "openText", headline: { default: "Skipped (undefined)" } },
      { id: "el-3", type: "openText", headline: { default: "Skipped (empty string)" } },
      { id: "el-4", type: "multipleChoiceMulti", headline: { default: "Skipped (empty array)" } },
    ]);
    const responseData: TResponseData = {
      "el-1": "Great product",
      "el-3": "",
      "el-4": [],
    };

    const prompt = buildResponseAnalysisPrompt(survey, responseData);

    expect(prompt.hasContent).toBe(true);
    expect(prompt.user).toBe("Survey response to analyze:\n\nQ: Answered\nA: Great product");
  });

  test("joins array answers with a comma", () => {
    const survey = surveyWithElements([
      { id: "el-1", type: "multipleChoiceMulti", headline: { default: "Select features" } },
    ]);
    const responseData: TResponseData = { "el-1": ["Speed", "Quality"] };

    const prompt = buildResponseAnalysisPrompt(survey, responseData);

    expect(prompt.user).toContain("A: Speed, Quality");
  });

  test("flattens object answers (e.g. matrix responses) into key: value pairs", () => {
    const survey = surveyWithElements([
      { id: "el-1", type: "matrix", headline: { default: "Rate each feature" } },
    ]);
    const responseData: TResponseData = { "el-1": { Speed: "Good", Quality: "Bad" } as never };

    const prompt = buildResponseAnalysisPrompt(survey, responseData);

    expect(prompt.user).toContain("A: Speed: Good; Quality: Bad");
  });

  test("skips elements whose headline is blank after trimming", () => {
    const survey = surveyWithElements([
      { id: "el-1", type: "openText", headline: { default: "   " } },
      { id: "el-2", type: "openText" },
    ]);
    const responseData: TResponseData = { "el-1": "answer one", "el-2": "answer two" };

    const prompt = buildResponseAnalysisPrompt(survey, responseData);

    expect(prompt.hasContent).toBe(false);
  });

  test("reports no content and a fallback user message when nothing is answerable", () => {
    const survey = surveyWithElements([
      { id: "el-1", type: "openText", headline: { default: "Any feedback?" } },
    ]);
    const responseData: TResponseData = {};

    const prompt = buildResponseAnalysisPrompt(survey, responseData);

    expect(prompt.hasContent).toBe(false);
    expect(prompt.user).toBe("The respondent did not provide any answerable content.");
  });

  test("returns hasContent false for a survey with no blocks/elements", () => {
    const survey = { id: "survey-1", blocks: [] } as unknown as TSurvey;

    const prompt = buildResponseAnalysisPrompt(survey, {});

    expect(prompt.hasContent).toBe(false);
  });

  test("instructs canonical English enum values and Spanish free text in the system prompt", () => {
    const survey = surveyWithElements([]);

    const prompt = buildResponseAnalysisPrompt(survey, {});

    expect(prompt.system).toContain(
      "The fields sentiment, severity and customer_effort must use their canonical English enum values."
    );
    expect(prompt.system).toContain("must be written in Spanish");
  });
});
