export type TExportFormat = "pdf" | "pptx";

export interface TExportPanelImage {
  widgetId: string;
  title: string;
  dataUrl: string;
  width: number;
  height: number;
}

export interface TExportReportSection {
  heading: string;
  bullets: string[];
}
