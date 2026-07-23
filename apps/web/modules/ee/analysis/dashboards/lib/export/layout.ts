export interface TBoxLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Scales an image to fit within a bounding box while preserving its aspect ratio, centering the
 * result inside the box. Used to place captured panel PNGs onto PDF pages / PPTX slides of a
 * fixed size without stretching or cropping them.
 */
export const fitImageToBox = (
  imageWidth: number,
  imageHeight: number,
  boxWidth: number,
  boxHeight: number
): TBoxLayout => {
  if (imageWidth <= 0 || imageHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const scale = Math.min(boxWidth / imageWidth, boxHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    x: (boxWidth - width) / 2,
    y: (boxHeight - height) / 2,
    width,
    height,
  };
};

const FILENAME_UNSAFE_CHARS = /[^a-z0-9-_]+/gi;
const FILENAME_EDGE_DASHES = /^-+|-+$/g;
const MAX_FILENAME_BASE_LENGTH = 80;
const FALLBACK_FILENAME_BASE = "export";

/**
 * Builds a safe, timestamped file name for an exported document, e.g.
 * "quarterly-nps_2026-07-22.pdf". Falls back to a generic base when the title normalizes to
 * nothing (e.g. only emoji/symbols).
 */
export const buildExportFileName = (
  title: string,
  format: "pdf" | "pptx",
  date: Date = new Date()
): string => {
  const isoDate = date.toISOString().slice(0, 10);
  const base =
    title
      .trim()
      .replace(FILENAME_UNSAFE_CHARS, "-")
      .replace(FILENAME_EDGE_DASHES, "")
      .slice(0, MAX_FILENAME_BASE_LENGTH) || FALLBACK_FILENAME_BASE;

  return `${base}_${isoDate}.${format}`;
};
