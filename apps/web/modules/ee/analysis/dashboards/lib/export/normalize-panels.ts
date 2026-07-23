import type { TExportPanelImage } from "./types";

export interface TCapturedPanel {
  dataUrl: string;
  width: number;
  height: number;
}

export interface TExportableWidget {
  id: string;
  chart: { name: string } | null;
}

/**
 * Combines dashboard widgets with their captured PNG snapshots, preserving dashboard order and
 * skipping widgets that have no chart or failed to capture (e.g. still loading, errored, or not
 * currently mounted in the DOM).
 */
export const normalizeExportPanels = (
  widgets: TExportableWidget[],
  captured: ReadonlyMap<string, TCapturedPanel>
): TExportPanelImage[] =>
  widgets.reduce<TExportPanelImage[]>((panels, widget) => {
    const snapshot = captured.get(widget.id);
    if (!widget.chart || !snapshot) {
      return panels;
    }

    panels.push({
      widgetId: widget.id,
      title: widget.chart.name,
      dataUrl: snapshot.dataUrl,
      width: snapshot.width,
      height: snapshot.height,
    });

    return panels;
  }, []);
