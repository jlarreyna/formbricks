import "server-only";
import { logger } from "@formbricks/logger";
import type { TChartQuery } from "@formbricks/types/analysis";
import { generateOrganizationAIObject } from "@/lib/ai/service";
import { executeTenantScopedQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import { checkFeedbackDirectoryAccess } from "@/modules/ee/analysis/lib/access";
import { type TDashboardAIReportPanelInput, buildDashboardAIReportPrompt } from "./build-prompt";
import {
  type TDashboardAIReportHeadings,
  type TDashboardAIReportSection,
  ZDashboardAIReportOutput,
  buildDashboardAIReportSections,
} from "./sections";

const AI_REPORT_GENERATION_TIMEOUT_MS = 45_000;
const AI_REPORT_MAX_OUTPUT_TOKENS = 2048;

export interface TDashboardAIReportWidgetInput {
  id: string;
  chart: { name: string; query: TChartQuery; feedbackDirectoryId: string } | null;
}

export interface TGenerateDashboardAIReportInput {
  organizationId: string;
  workspaceId: string;
  userId: string;
  dashboardName: string;
  widgets: TDashboardAIReportWidgetInput[];
  headings: TDashboardAIReportHeadings;
}

const loadPanelData = async (
  widget: TDashboardAIReportWidgetInput & { chart: NonNullable<TDashboardAIReportWidgetInput["chart"]> },
  organizationId: string,
  workspaceId: string,
  userId: string
): Promise<TDashboardAIReportPanelInput> => {
  try {
    const tenant = await checkFeedbackDirectoryAccess({
      feedbackDirectoryId: widget.chart.feedbackDirectoryId,
      organizationId,
      workspaceId,
      userId,
      source: "dashboards.export",
    });
    const data = await executeTenantScopedQuery({
      query: widget.chart.query,
      feedbackDirectoryId: tenant.feedbackDirectoryId,
      workspaceId,
      organizationId,
      userId,
      source: "dashboards.export",
    });
    return { title: widget.chart.name, data: Array.isArray(data) ? data : [] };
  } catch (error) {
    logger.error(error, "Failed to load panel data for dashboard AI report");
    return { title: widget.chart.name, data: [] };
  }
};

/**
 * Generates an AI-written report (summary, key findings, recommendations) for a dashboard or a
 * subset of its widgets, grounded in the same aggregated Cube data the widgets themselves
 * display. Returns normalized sections ready to be appended to an exported PDF/PPTX.
 */
export const generateDashboardAIReport = async ({
  organizationId,
  workspaceId,
  userId,
  dashboardName,
  widgets,
  headings,
}: TGenerateDashboardAIReportInput): Promise<TDashboardAIReportSection[]> => {
  const widgetsWithCharts = widgets.filter(
    (widget): widget is TDashboardAIReportWidgetInput & { chart: NonNullable<typeof widget.chart> } =>
      !!widget.chart
  );

  const panels = await Promise.all(
    widgetsWithCharts.map((widget) => loadPanelData(widget, organizationId, workspaceId, userId))
  );

  const prompt = buildDashboardAIReportPrompt(dashboardName, panels);

  const { object } = await generateOrganizationAIObject({
    organizationId,
    schema: ZDashboardAIReportOutput,
    system: prompt.system,
    prompt: prompt.user,
    temperature: 0.3,
    maxOutputTokens: AI_REPORT_MAX_OUTPUT_TOKENS,
    timeout: AI_REPORT_GENERATION_TIMEOUT_MS,
  });

  return buildDashboardAIReportSections(object, headings);
};
