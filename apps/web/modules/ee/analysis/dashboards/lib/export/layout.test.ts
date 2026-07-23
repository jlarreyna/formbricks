import { describe, expect, test } from "vitest";
import { buildExportFileName, fitImageToBox } from "./layout";

describe("fitImageToBox", () => {
  test("scales a wider-than-box image down to fit the box width", () => {
    const layout = fitImageToBox(2000, 1000, 200, 200);

    expect(layout.width).toBe(200);
    expect(layout.height).toBe(100);
    expect(layout.x).toBe(0);
    expect(layout.y).toBe(50);
  });

  test("scales a taller-than-box image down to fit the box height", () => {
    const layout = fitImageToBox(1000, 2000, 200, 200);

    expect(layout.width).toBe(100);
    expect(layout.height).toBe(200);
    expect(layout.x).toBe(50);
    expect(layout.y).toBe(0);
  });

  test("upscales an image smaller than the box while preserving aspect ratio", () => {
    const layout = fitImageToBox(100, 50, 400, 400);

    expect(layout.width).toBe(400);
    expect(layout.height).toBe(200);
    expect(layout.x).toBe(0);
    expect(layout.y).toBe(100);
  });

  test("returns a zeroed layout for non-positive dimensions", () => {
    expect(fitImageToBox(0, 100, 200, 200)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(fitImageToBox(100, 100, 0, 200)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(fitImageToBox(-10, 100, 200, 200)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe("buildExportFileName", () => {
  const fixedDate = new Date("2026-07-22T12:00:00.000Z");

  test("sanitizes unsafe characters and appends the date and extension", () => {
    expect(buildExportFileName("Q3 NPS Report!", "pdf", fixedDate)).toBe("Q3-NPS-Report_2026-07-22.pdf");
  });

  test("uses the pptx extension when requested", () => {
    expect(buildExportFileName("Sales", "pptx", fixedDate)).toBe("Sales_2026-07-22.pptx");
  });

  test("trims leading/trailing separators produced by sanitization", () => {
    expect(buildExportFileName("  ¡Hola Mundo!  ", "pdf", fixedDate)).toBe("Hola-Mundo_2026-07-22.pdf");
  });

  test("falls back to a generic base name when the title has no safe characters", () => {
    expect(buildExportFileName("★★★", "pdf", fixedDate)).toBe("export_2026-07-22.pdf");
  });

  test("truncates very long titles to keep the file name manageable", () => {
    const longTitle = "a".repeat(200);
    const fileName = buildExportFileName(longTitle, "pdf", fixedDate);

    expect(fileName).toBe(`${"a".repeat(80)}_2026-07-22.pdf`);
  });
});
