import { describe, expect, test } from "vitest";
import { parseContactabilityRules, resolveContactabilityConfig } from "./resolve-config";

describe("parseContactabilityRules", () => {
  test("seeds cooldown from recontactDays when rules are missing", () => {
    const rules = parseContactabilityRules(null, 14);
    expect(rules.cooldown).toEqual({ enabled: true, period: 14, unit: "days" });
  });

  test("disables cooldown when recontactDays is 0", () => {
    const rules = parseContactabilityRules(undefined, 0);
    expect(rules.cooldown.enabled).toBe(false);
    expect(rules.cooldown.period).toBe(0);
  });
});

describe("resolveContactabilityConfig", () => {
  test("merges workspace and survey audience config", () => {
    const config = resolveContactabilityConfig({
      workspaceRules: {
        cooldown: { enabled: true, period: 2, unit: "days" },
        frequencyLimits: {
          enabled: true,
          perDay: 1,
          perWeek: null,
          perMonth: null,
          perYear: null,
        },
        fatigueScore: { enabled: true, maxScore: 70 },
      },
      audienceFilters: {
        includedSegments: { enabled: true, filters: [] },
        excludedSegments: { enabled: false, filters: [] },
      },
      priority: 5,
    });

    expect(config.cooldown.period).toBe(2);
    expect(config.frequencyLimits.perDay).toBe(1);
    expect(config.includedSegments.enabled).toBe(true);
    expect(config.priority).toBe(5);
  });
});
