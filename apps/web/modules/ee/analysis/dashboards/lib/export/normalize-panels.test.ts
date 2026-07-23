import { describe, expect, test } from "vitest";
import { type TCapturedPanel, type TExportableWidget, normalizeExportPanels } from "./normalize-panels";

const buildCaptured = (dataUrl: string): TCapturedPanel => ({ dataUrl, width: 800, height: 600 });

describe("normalizeExportPanels", () => {
  test("maps each widget to its captured panel, preserving dashboard order", () => {
    const widgets: TExportableWidget[] = [
      { id: "widget-1", chart: { name: "NPS over time" } },
      { id: "widget-2", chart: { name: "Sentiment breakdown" } },
    ];
    const captured = new Map([
      ["widget-1", buildCaptured("data:image/png;base64,AAA")],
      ["widget-2", buildCaptured("data:image/png;base64,BBB")],
    ]);

    const panels = normalizeExportPanels(widgets, captured);

    expect(panels).toEqual([
      {
        widgetId: "widget-1",
        title: "NPS over time",
        dataUrl: "data:image/png;base64,AAA",
        width: 800,
        height: 600,
      },
      {
        widgetId: "widget-2",
        title: "Sentiment breakdown",
        dataUrl: "data:image/png;base64,BBB",
        width: 800,
        height: 600,
      },
    ]);
  });

  test("skips widgets without a chart", () => {
    const widgets: TExportableWidget[] = [{ id: "widget-1", chart: null }];
    const captured = new Map([["widget-1", buildCaptured("data:image/png;base64,AAA")]]);

    expect(normalizeExportPanels(widgets, captured)).toEqual([]);
  });

  test("skips widgets that were not captured (e.g. still loading or not mounted)", () => {
    const widgets: TExportableWidget[] = [
      { id: "widget-1", chart: { name: "Loaded panel" } },
      { id: "widget-2", chart: { name: "Not captured" } },
    ];
    const captured = new Map([["widget-1", buildCaptured("data:image/png;base64,AAA")]]);

    const panels = normalizeExportPanels(widgets, captured);

    expect(panels).toHaveLength(1);
    expect(panels[0].widgetId).toBe("widget-1");
  });

  test("returns an empty array when given no widgets", () => {
    expect(normalizeExportPanels([], new Map())).toEqual([]);
  });
});
