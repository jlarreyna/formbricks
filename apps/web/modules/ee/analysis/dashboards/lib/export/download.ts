"use client";

/**
 * Triggers a browser download of a generated file Blob (PDF/PPTX) without navigating away from
 * the page, mirroring the pattern used for response export downloads.
 */
export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};
