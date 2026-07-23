"use client";

import { toPng } from "html-to-image";

export interface TCapturedNode {
  dataUrl: string;
  width: number;
  height: number;
}

const CAPTURE_BACKGROUND_COLOR = "#ffffff";
const CAPTURE_PIXEL_RATIO = 2;

/**
 * Captures a rendered DOM node (e.g. a dashboard widget's chart body) as a PNG data URL, for
 * embedding into an exported PDF/PPTX. Chart libraries like Recharts render to SVG in the
 * browser, so this must run client-side against the live, mounted node.
 */
export const captureNodeToPng = async (node: HTMLElement): Promise<TCapturedNode> => {
  const dataUrl = await toPng(node, {
    backgroundColor: CAPTURE_BACKGROUND_COLOR,
    pixelRatio: CAPTURE_PIXEL_RATIO,
  });

  return {
    dataUrl,
    width: node.offsetWidth,
    height: node.offsetHeight,
  };
};
