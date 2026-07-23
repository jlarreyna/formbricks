"use client";

import { jsPDF } from "jspdf";
import { fitImageToBox } from "./layout";
import type { TExportPanelImage, TExportReportSection } from "./types";

const PAGE_WIDTH_MM = 297;
const PAGE_HEIGHT_MM = 210;
const MARGIN_MM = 15;
const TITLE_HEIGHT_MM = 12;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;
const BULLET_LINE_HEIGHT_MM = 6;
const BULLET_GAP_MM = 3;

export interface TBuildDashboardPdfInput {
  documentTitle: string;
  generatedAtLabel: string;
  panels: TExportPanelImage[];
  aiReportTitle?: string;
  aiReportSections?: TExportReportSection[];
}

const addCoverPage = (doc: jsPDF, documentTitle: string, generatedAtLabel: string) => {
  doc.setFontSize(20);
  doc.text(documentTitle, MARGIN_MM, MARGIN_MM + 6);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(generatedAtLabel, MARGIN_MM, MARGIN_MM + 14);
  doc.setTextColor(0);
};

const addPanelPage = (doc: jsPDF, panel: TExportPanelImage) => {
  doc.addPage();
  doc.setFontSize(14);
  doc.text(panel.title, MARGIN_MM, MARGIN_MM + 4);

  const boxHeight = PAGE_HEIGHT_MM - MARGIN_MM * 2 - TITLE_HEIGHT_MM;
  const layout = fitImageToBox(panel.width, panel.height, CONTENT_WIDTH_MM, boxHeight);

  doc.addImage(
    panel.dataUrl,
    "PNG",
    MARGIN_MM + layout.x,
    MARGIN_MM + TITLE_HEIGHT_MM + layout.y,
    layout.width,
    layout.height
  );
};

const addReportSectionPage = (doc: jsPDF, reportTitle: string, section: TExportReportSection) => {
  doc.addPage();
  let cursorY = MARGIN_MM + 4;

  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text(reportTitle, MARGIN_MM, cursorY);
  doc.setTextColor(0);
  cursorY += 10;

  doc.setFontSize(15);
  doc.text(section.heading, MARGIN_MM, cursorY);
  cursorY += 9;

  doc.setFontSize(11);
  for (const bullet of section.bullets) {
    const lines: string[] = doc.splitTextToSize(`•  ${bullet}`, CONTENT_WIDTH_MM);
    doc.text(lines, MARGIN_MM, cursorY);
    cursorY += lines.length * BULLET_LINE_HEIGHT_MM + BULLET_GAP_MM;
  }
};

/**
 * Builds a landscape A4 PDF with a cover page, one page per exported panel (title + captured
 * chart image), and — when provided — one page per AI report section appended at the end.
 */
export const buildDashboardPdf = ({
  documentTitle,
  generatedAtLabel,
  panels,
  aiReportTitle,
  aiReportSections,
}: TBuildDashboardPdfInput): Blob => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  addCoverPage(doc, documentTitle, generatedAtLabel);
  panels.forEach((panel) => addPanelPage(doc, panel));
  aiReportSections?.forEach((section) => addReportSectionPage(doc, aiReportTitle ?? "", section));

  return doc.output("blob");
};
