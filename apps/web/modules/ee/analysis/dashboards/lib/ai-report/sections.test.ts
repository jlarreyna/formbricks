import { describe, expect, test } from "vitest";
import { type TDashboardAIReportOutput, buildDashboardAIReportSections } from "./sections";

const headings = {
  summary: "Summary",
  keyFindings: "Key findings",
  recommendations: "Recommendations",
};

describe("buildDashboardAIReportSections", () => {
  test("builds one section per non-empty field, in summary -> findings -> recommendations order", () => {
    const report: TDashboardAIReportOutput = {
      summary: "Overall satisfaction is trending up.",
      keyFindings: ["NPS increased by 12 points", "Drop-off rate decreased"],
      recommendations: ["Keep investing in onboarding"],
    };

    const sections = buildDashboardAIReportSections(report, headings);

    expect(sections).toEqual([
      { heading: "Summary", bullets: ["Overall satisfaction is trending up."] },
      { heading: "Key findings", bullets: ["NPS increased by 12 points", "Drop-off rate decreased"] },
      { heading: "Recommendations", bullets: ["Keep investing in onboarding"] },
    ]);
  });

  test("omits the summary section when the summary is blank", () => {
    const report: TDashboardAIReportOutput = {
      summary: "   ",
      keyFindings: ["Finding"],
      recommendations: [],
    };

    const sections = buildDashboardAIReportSections(report, headings);

    expect(sections.map((s) => s.heading)).toEqual(["Key findings"]);
  });

  test("omits the key findings and recommendations sections when their arrays are empty", () => {
    const report: TDashboardAIReportOutput = {
      summary: "Summary text",
      keyFindings: [],
      recommendations: [],
    };

    const sections = buildDashboardAIReportSections(report, headings);

    expect(sections).toEqual([{ heading: "Summary", bullets: ["Summary text"] }]);
  });

  test("filters out blank bullets within key findings and recommendations", () => {
    const report: TDashboardAIReportOutput = {
      summary: "",
      keyFindings: ["Valid finding", "   ", ""],
      recommendations: ["  ", "Valid recommendation"],
    };

    const sections = buildDashboardAIReportSections(report, headings);

    expect(sections).toEqual([
      { heading: "Key findings", bullets: ["Valid finding"] },
      { heading: "Recommendations", bullets: ["Valid recommendation"] },
    ]);
  });

  test("trims whitespace around each bullet and the summary", () => {
    const report: TDashboardAIReportOutput = {
      summary: "  Trimmed summary  ",
      keyFindings: ["  Trimmed finding  "],
      recommendations: [],
    };

    const sections = buildDashboardAIReportSections(report, headings);

    expect(sections[0].bullets[0]).toBe("Trimmed summary");
    expect(sections[1].bullets[0]).toBe("Trimmed finding");
  });

  test("returns an empty array when every field is empty", () => {
    const report: TDashboardAIReportOutput = { summary: "", keyFindings: [], recommendations: [] };

    expect(buildDashboardAIReportSections(report, headings)).toEqual([]);
  });
});
