import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";

export interface TDashboardAIReportPanelInput {
  title: string;
  data: TChartDataRow[];
}

export interface TDashboardAIReportPrompt {
  system: string;
  user: string;
}

const MAX_ROWS_PER_PANEL = 50;

const stringifyRow = (row: TChartDataRow): string =>
  Object.entries(row)
    .map(([key, value]) => `${key}: ${value ?? "—"}`)
    .join(", ");

/**
 * Builds the system/user prompt for an AI-generated dashboard report: one section per panel,
 * summarizing that panel's aggregated (anonymized) chart data so the model can describe trends
 * and suggest actions grounded in the actual numbers rather than inventing content.
 */
export const buildDashboardAIReportPrompt = (
  dashboardName: string,
  panels: TDashboardAIReportPanelInput[]
): TDashboardAIReportPrompt => {
  const system = [
    "You are an analyst preparing an executive report from a feedback analytics dashboard.",
    "You are given aggregated, anonymized chart data only (no personal information).",
    "For each panel, identify the most important trend or standout figure.",
    "Then write an overall summary, a list of key findings, and a list of concrete recommendations.",
    "All free-text fields (summary, keyFindings, recommendations) must be written in Spanish, concise and specific to the provided data.",
    "Base every statement strictly on the provided data; never invent numbers or facts not present in it.",
  ].join(" ");

  const panelSections =
    panels.length > 0
      ? panels
          .map((panel) => {
            const rows = panel.data.slice(0, MAX_ROWS_PER_PANEL).map(stringifyRow).join("\n");
            return `Panel: ${panel.title}\n${rows || "No data available."}`;
          })
          .join("\n\n")
      : "No panel data available.";

  const user = `Dashboard: ${dashboardName}\n\n${panelSections}`;

  return { system, user };
};
