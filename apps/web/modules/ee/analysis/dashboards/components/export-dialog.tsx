"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import type { TAIUnavailableReason } from "@/modules/ee/analysis/charts/lib/ai-availability";
import { generateDashboardAIReportAction } from "@/modules/ee/analysis/dashboards/actions";
import { buildDashboardPdf } from "@/modules/ee/analysis/dashboards/lib/export/build-pdf";
import { buildDashboardPptx } from "@/modules/ee/analysis/dashboards/lib/export/build-pptx";
import { type TCapturedNode, captureNodeToPng } from "@/modules/ee/analysis/dashboards/lib/export/capture";
import { downloadBlob } from "@/modules/ee/analysis/dashboards/lib/export/download";
import { buildExportFileName } from "@/modules/ee/analysis/dashboards/lib/export/layout";
import { normalizeExportPanels } from "@/modules/ee/analysis/dashboards/lib/export/normalize-panels";
import type { TExportFormat } from "@/modules/ee/analysis/dashboards/lib/export/types";
import type { TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Label } from "@/modules/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@/modules/ui/components/radio-group";

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "panel" | "dashboard";
  workspaceId: string;
  dashboardId: string;
  dashboardName: string;
  widgets: TDashboardWidget[];
  getPanelNode: (widgetId: string) => HTMLElement | null;
  isAIAvailable?: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
}

const translateAIUnavailableMessage = (
  t: (key: string) => string,
  reason: TAIUnavailableReason | undefined
): string => {
  switch (reason) {
    case "not_in_plan":
      return t("workspace.analysis.dashboards.export.ai_not_in_plan");
    case "not_enabled":
      return t("workspace.analysis.dashboards.export.ai_not_enabled");
    case "instance_not_configured":
      return t("workspace.analysis.dashboards.export.ai_instance_not_configured");
    default:
      return t("workspace.analysis.dashboards.export.ai_not_available");
  }
};

export function ExportDialog({
  open,
  onOpenChange,
  mode,
  workspaceId,
  dashboardId,
  dashboardName,
  widgets,
  getPanelNode,
  isAIAvailable,
  aiUnavailableReason,
}: Readonly<ExportDialogProps>) {
  const { t, i18n } = useTranslation();
  const [format, setFormat] = useState<TExportFormat>("pdf");
  const [includeAIReport, setIncludeAIReport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const documentTitle = mode === "panel" ? (widgets[0]?.chart?.name ?? dashboardName) : dashboardName;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const captured = new Map<string, TCapturedNode>();
      for (const widget of widgets) {
        const node = widget.chart ? getPanelNode(widget.id) : null;
        if (!node) continue;
        try {
          captured.set(widget.id, await captureNodeToPng(node));
        } catch {
          // Skip panels that fail to render as an image; the export continues with the rest.
        }
      }

      const panels = normalizeExportPanels(widgets, captured);
      if (panels.length === 0) {
        toast.error(t("workspace.analysis.dashboards.export.no_panels_to_export"));
        return;
      }

      let aiReportSections;
      if (includeAIReport && isAIAvailable) {
        try {
          const result = await generateDashboardAIReportAction({
            workspaceId,
            dashboardId,
            widgetIds: mode === "panel" ? widgets.map((widget) => widget.id) : undefined,
          });
          if (result?.data) {
            aiReportSections = result.data.sections;
          } else {
            toast.error(getFormattedErrorMessage(result));
          }
        } catch {
          toast.error(t("workspace.analysis.dashboards.export.ai_report_failed"));
        }
      }

      const generatedAtLabel = t("workspace.analysis.dashboards.export.generated_at", {
        date: formatDateForDisplay(new Date(), i18n.resolvedLanguage),
      });
      const aiReportTitle = t("workspace.analysis.dashboards.export.ai_report_title");

      const blob =
        format === "pdf"
          ? buildDashboardPdf({ documentTitle, generatedAtLabel, panels, aiReportTitle, aiReportSections })
          : await buildDashboardPptx({
              documentTitle,
              generatedAtLabel,
              panels,
              aiReportTitle,
              aiReportSections,
            });

      downloadBlob(blob, buildExportFileName(documentTitle, format));
      toast.success(t("workspace.analysis.dashboards.export.export_success"));
      onOpenChange(false);
    } catch {
      toast.error(t("workspace.analysis.dashboards.export.export_failed"));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "panel"
              ? t("workspace.analysis.dashboards.export.export_panel_title")
              : t("workspace.analysis.dashboards.export.export_dashboard_title")}
          </DialogTitle>
          <DialogDescription>
            {t("workspace.analysis.dashboards.export.export_description")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-6">
          <div className="space-y-2">
            <Label>{t("workspace.analysis.dashboards.export.format_label")}</Label>
            <RadioGroup
              value={format}
              onValueChange={(value) => setFormat(value as TExportFormat)}
              className="grid-flow-col justify-start gap-x-6">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="pdf" id="export-format-pdf" />
                <Label htmlFor="export-format-pdf" className="font-normal">
                  {t("workspace.analysis.dashboards.export.format_pdf")}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="pptx" id="export-format-pptx" />
                <Label htmlFor="export-format-pptx" className="font-normal">
                  {t("workspace.analysis.dashboards.export.format_pptx")}
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Checkbox
                id="export-include-ai-report"
                checked={includeAIReport}
                disabled={!isAIAvailable}
                onCheckedChange={(checked) => setIncludeAIReport(checked === true)}
              />
              <Label htmlFor="export-include-ai-report" className="font-normal">
                {t("workspace.analysis.dashboards.export.include_ai_report")}
              </Label>
            </div>
            {!isAIAvailable && (
              <p className="pl-7 text-xs text-slate-500">
                {translateAIUnavailableMessage(t, aiUnavailableReason)}
              </p>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleExport} loading={isExporting} disabled={isExporting}>
            {t("workspace.analysis.dashboards.export.export_action")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
