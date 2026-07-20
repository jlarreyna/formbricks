import "server-only";
import type { TResponseData, TResponseDataValue } from "@formbricks/types/responses";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";

const stringifyAnswerValue = (value: TResponseDataValue): string => {
  if (value === undefined || value === null) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, val]) => `${key}: ${val}`)
      .join("; ");
  }
  return String(value);
};

export interface TResponseAnalysisPrompt {
  system: string;
  user: string;
  hasContent: boolean;
}

/**
 * Builds the system/user prompt for LLM-based response analysis by pairing each survey
 * question's headline with the respondent's answer from `response.data`. Elements without a
 * recorded answer (skipped questions, hidden fields) are omitted.
 */
export const buildResponseAnalysisPrompt = (
  survey: TSurvey,
  responseData: TResponseData
): TResponseAnalysisPrompt => {
  const elements = getElementsFromBlocks(survey.blocks);

  const qaPairs = elements
    .map((element) => {
      const rawValue = responseData[element.id];
      if (rawValue === undefined || rawValue === "" || (Array.isArray(rawValue) && rawValue.length === 0)) {
        return null;
      }

      const question = getLocalizedValue(element.headline, "default").trim();
      const answer = stringifyAnswerValue(rawValue);
      if (!question || !answer) {
        return null;
      }

      return `Q: ${question}\nA: ${answer}`;
    })
    .filter((pair): pair is string => pair !== null);

  const system = [
    "You are an assistant that analyzes a single survey response on behalf of the organization that collects it.",
    "Read the question/answer pairs provided and return a structured analysis using the provided schema.",
    "The fields sentiment, severity and customer_effort must use their canonical English enum values.",
    'All free-text fields (emotion, categories, topics, keywords, recommended_department, recommended_priority, summary) must be written in Spanish, concise and specific to the content of the response (for example: "Frustración", "Equipaje perdido").',
    "Base sentiment_score, confidence and requires_followup strictly on the evidence in the answers; do not invent details that are not supported by the response.",
  ].join(" ");

  const user =
    qaPairs.length > 0
      ? `Survey response to analyze:\n\n${qaPairs.join("\n\n")}`
      : "The respondent did not provide any answerable content.";

  return { system, user, hasContent: qaPairs.length > 0 };
};
