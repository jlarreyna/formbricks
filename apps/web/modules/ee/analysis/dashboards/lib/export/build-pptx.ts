"use client";

import PptxGenJS from "pptxgenjs";
import { fitImageToBox } from "./layout";
import type { TExportPanelImage, TExportReportSection } from "./types";

const SLIDE_WIDTH_IN = 13.333;
const SLIDE_HEIGHT_IN = 7.5;
const MARGIN_IN = 0.5;
const TITLE_HEIGHT_IN = 0.6;
const CONTENT_WIDTH_IN = SLIDE_WIDTH_IN - MARGIN_IN * 2;

export interface TBuildDashboardPptxInput {
  documentTitle: string;
  generatedAtLabel: string;
  panels: TExportPanelImage[];
  aiReportTitle?: string;
  aiReportSections?: TExportReportSection[];
}

const addCoverSlide = (pptx: PptxGenJS, documentTitle: string, generatedAtLabel: string) => {
  const slide = pptx.addSlide();
  slide.addText(documentTitle, {
    x: MARGIN_IN,
    y: SLIDE_HEIGHT_IN / 2 - 0.6,
    w: CONTENT_WIDTH_IN,
    h: 1,
    fontSize: 32,
    bold: true,
  });
  slide.addText(generatedAtLabel, {
    x: MARGIN_IN,
    y: SLIDE_HEIGHT_IN / 2 + 0.3,
    w: CONTENT_WIDTH_IN,
    h: 0.4,
    fontSize: 14,
    color: "666666",
  });
};

const addPanelSlide = (pptx: PptxGenJS, panel: TExportPanelImage) => {
  const slide = pptx.addSlide();
  slide.addText(panel.title, {
    x: MARGIN_IN,
    y: MARGIN_IN,
    w: CONTENT_WIDTH_IN,
    h: TITLE_HEIGHT_IN,
    fontSize: 18,
    bold: true,
  });

  const boxHeight = SLIDE_HEIGHT_IN - MARGIN_IN * 2 - TITLE_HEIGHT_IN;
  const layout = fitImageToBox(panel.width, panel.height, CONTENT_WIDTH_IN, boxHeight);

  slide.addImage({
    data: panel.dataUrl,
    x: MARGIN_IN + layout.x,
    y: MARGIN_IN + TITLE_HEIGHT_IN + layout.y,
    w: layout.width,
    h: layout.height,
  });
};

const addReportSection = (pptx: PptxGenJS, reportTitle: string, section: TExportReportSection) => {
  const slide = pptx.addSlide();
  slide.addText(reportTitle, {
    x: MARGIN_IN,
    y: MARGIN_IN,
    w: CONTENT_WIDTH_IN,
    h: 0.4,
    fontSize: 12,
    color: "666666",
  });
  slide.addText(section.heading, {
    x: MARGIN_IN,
    y: MARGIN_IN + 0.4,
    w: CONTENT_WIDTH_IN,
    h: 0.6,
    fontSize: 20,
    bold: true,
  });
  slide.addText(
    section.bullets.map((bullet) => ({ text: bullet, options: { bullet: true, breakLine: true } })),
    {
      x: MARGIN_IN,
      y: MARGIN_IN + 1.1,
      w: CONTENT_WIDTH_IN,
      h: SLIDE_HEIGHT_IN - MARGIN_IN * 2 - 1.1,
      fontSize: 13,
      valign: "top",
    }
  );
};

/**
 * Builds a widescreen PPTX with a cover slide, one slide per exported panel (title + captured
 * chart image), and — when provided — one slide per AI report section appended at the end.
 */
export const buildDashboardPptx = async ({
  documentTitle,
  generatedAtLabel,
  panels,
  aiReportTitle,
  aiReportSections,
}: TBuildDashboardPptxInput): Promise<Blob> => {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "FORMBRICKS_WIDESCREEN", width: SLIDE_WIDTH_IN, height: SLIDE_HEIGHT_IN });
  pptx.layout = "FORMBRICKS_WIDESCREEN";

  addCoverSlide(pptx, documentTitle, generatedAtLabel);
  panels.forEach((panel) => addPanelSlide(pptx, panel));
  aiReportSections?.forEach((section) => addReportSection(pptx, aiReportTitle ?? "", section));

  const blob = await pptx.write({ outputType: "blob" });
  return blob as Blob;
};
