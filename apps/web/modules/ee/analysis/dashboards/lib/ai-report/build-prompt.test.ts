import { describe, expect, test } from "vitest";
import { buildDashboardAIReportPrompt } from "./build-prompt";

describe("buildDashboardAIReportPrompt", () => {
  test("includes the dashboard name and one section per panel", () => {
    const prompt = buildDashboardAIReportPrompt("Q3 Feedback", [
      { title: "NPS over time", data: [{ "FeedbackRecords.nps": 42 }] },
      { title: "Sentiment breakdown", data: [{ "FeedbackRecords.sentiment": "positive", count: 10 }] },
    ]);

    expect(prompt.user).toBe(
      "Dashboard: Q3 Feedback\n\n" +
        "Panel: NPS over time\nFeedbackRecords.nps: 42\n\n" +
        "Panel: Sentiment breakdown\nFeedbackRecords.sentiment: positive, count: 10"
    );
  });

  test("reports 'No data available' for a panel with an empty data array", () => {
    const prompt = buildDashboardAIReportPrompt("Dashboard", [{ title: "Empty panel", data: [] }]);

    expect(prompt.user).toBe("Dashboard: Dashboard\n\nPanel: Empty panel\nNo data available.");
  });

  test("reports 'No panel data available' when there are no panels at all", () => {
    const prompt = buildDashboardAIReportPrompt("Dashboard", []);

    expect(prompt.user).toBe("Dashboard: Dashboard\n\nNo panel data available.");
  });

  test("truncates each panel to the first 50 rows", () => {
    const manyRows = Array.from({ length: 60 }, (_, i) => ({ index: i }));
    const prompt = buildDashboardAIReportPrompt("Dashboard", [{ title: "Big panel", data: manyRows }]);

    const rowLines = prompt.user.split("\n").filter((line) => line.startsWith("index:"));
    expect(rowLines).toHaveLength(50);
    expect(rowLines[0]).toBe("index: 0");
    expect(rowLines[49]).toBe("index: 49");
  });

  test("renders null/undefined values as an em dash", () => {
    const prompt = buildDashboardAIReportPrompt("Dashboard", [
      { title: "Panel", data: [{ value: null, other: undefined }] },
    ]);

    expect(prompt.user).toContain("value: —, other: —");
  });

  test("instructs the model to only rely on the provided data", () => {
    const prompt = buildDashboardAIReportPrompt("Dashboard", []);

    expect(prompt.system).toContain("aggregated, anonymized chart data only");
    expect(prompt.system).toContain("never invent numbers or facts not present in it");
  });

  test("instructs free-text fields to be written in Spanish, matching response analysis", () => {
    const prompt = buildDashboardAIReportPrompt("Dashboard", []);

    expect(prompt.system).toContain(
      "All free-text fields (summary, keyFindings, recommendations) must be written in Spanish"
    );
  });
});
