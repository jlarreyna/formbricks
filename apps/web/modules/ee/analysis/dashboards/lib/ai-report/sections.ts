import { z } from "zod";

export const ZDashboardAIReportOutput = z.object({
  summary: z.string().describe("A concise executive summary of the dashboard, 2-4 sentences."),
  keyFindings: z.array(z.string()).describe("The most important, data-grounded observations."),
  recommendations: z.array(z.string()).describe("Concrete, actionable recommendations based on the data."),
});
export type TDashboardAIReportOutput = z.infer<typeof ZDashboardAIReportOutput>;

export interface TDashboardAIReportSection {
  heading: string;
  bullets: string[];
}

export interface TDashboardAIReportHeadings {
  summary: string;
  keyFindings: string;
  recommendations: string;
}

/**
 * Normalizes the raw AI-generated report object into an ordered list of sections ready to be
 * rendered as PDF pages / PPTX slides. Sections with no content (e.g. an empty recommendations
 * list, or only blank strings) are omitted so the exported document never shows an empty heading.
 */
export const buildDashboardAIReportSections = (
  report: TDashboardAIReportOutput,
  headings: TDashboardAIReportHeadings
): TDashboardAIReportSection[] => {
  const sections: TDashboardAIReportSection[] = [];

  const summary = report.summary.trim();
  if (summary) {
    sections.push({ heading: headings.summary, bullets: [summary] });
  }

  const keyFindings = report.keyFindings.map((finding) => finding.trim()).filter(Boolean);
  if (keyFindings.length > 0) {
    sections.push({ heading: headings.keyFindings, bullets: keyFindings });
  }

  const recommendations = report.recommendations
    .map((recommendation) => recommendation.trim())
    .filter(Boolean);
  if (recommendations.length > 0) {
    sections.push({ heading: headings.recommendations, bullets: recommendations });
  }

  return sections;
};
